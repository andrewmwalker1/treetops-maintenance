// Shared equipment check-out state machine: categories -> units -> confirm
// -> results, plus the inline "report an issue instead" branch. Originally
// lived entirely inside KioskCheckOut.jsx; pulled out so the main app's
// own Checkout Kit page (CheckoutKit.jsx, reachable from staff's own
// phones without a workshop kiosk terminal) runs the exact same logic
// rather than a hand-copied second version that drifts over time. Each
// caller supplies its own JSX/styling -- this only owns state and writes.
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";
import { getEquipmentTypeAvailabilityCounts, getAvailableUnits } from "./equipmentAvailability.js";
import { notifyJobAssigned } from "./jobAssignmentNotify.js";

export function useEquipmentCheckout() {
  const { profile, org } = useAuth();
  const [view, setView] = useState("categories"); // categories | units | confirm | results
  const [categories, setCategories] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [units, setUnits] = useState([]);
  // Holds one id for an ordinary checkout, several for a multi-checkout
  // type -- the confirm/checkout logic below doesn't distinguish the two,
  // only the "units" screen's selection UI does.
  const [selectedIds, setSelectedIds] = useState(new Set());
  // unit id -> the hours value typed for it (string, as entered) --
  // separate from selectedIds since only some selected units (those with
  // tracksHours resolved true, getAvailableUnits/equipmentAvailability.js)
  // need one.
  const [hoursByUnitId, setHoursByUnitId] = useState({});
  const [reportingIssueFor, setReportingIssueFor] = useState(null); // unit id, or null
  const [checkoutOutcome, setCheckoutOutcome] = useState(null); // set only when a multi checkout partially failed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!org) return;
    getEquipmentTypeAvailabilityCounts(org.id).then(setCategories);
  }, [org]);

  function openCategory(type) {
    setError(null);
    setSelectedType(type);
    setSelectedIds(new Set());
    setHoursByUnitId({});
    setCheckoutOutcome(null);
    getAvailableUnits(type.id).then((u) => {
      setUnits(u);
      setView("units");
    });
  }

  // Ordinary (non multi-checkout) flow: tapping a unit goes straight to
  // confirm, same as before multi-checkout existed.
  function selectUnit(unit) {
    setError(null);
    setReportingIssueFor(null);
    setSelectedIds(new Set([unit.id]));
    setView("confirm");
  }

  function setUnitHours(unitId, value) {
    setHoursByUnitId((prev) => ({ ...prev, [unitId]: value }));
  }

  function toggleUnit(unitId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  function backToCategories() {
    setView("categories");
    setSelectedType(null);
    setSelectedIds(new Set());
    setHoursByUnitId({});
    setReportingIssueFor(null);
    setCheckoutOutcome(null);
    if (org) getEquipmentTypeAvailabilityCounts(org.id).then(setCategories);
  }

  // Best-effort: each selected unit is checked out independently, so one
  // taken by someone else in the meantime doesn't block the rest. A unit
  // that tracks hours gets its reading recorded right after its own
  // checkout succeeds -- if that specific reading is rejected (someone
  // else's more recent, higher reading beat it to the last-known value,
  // or it's required but wasn't entered), that one unit's own checkout is
  // undone too, so "not checked out" in the results screen stays true
  // rather than silently leaving a checkout with no reading against it.
  async function handleCheckOut(onAllSucceeded) {
    setBusy(true);
    setError(null);
    const ids = [...selectedIds];
    const attempts = await Promise.all(
      ids.map(async (id) => {
        const unit = units.find((u) => u.id === id);
        const { data: inserted, error: err } = await supabase
          .from("equipment_checkouts")
          .insert({ equipment_id: id, profile_id: profile.id })
          .select("id")
          .single();
        if (err) return { id, err };

        if (unit?.tracksHours) {
          const raw = hoursByUnitId[id];
          if (raw === undefined || raw === "") {
            if (unit.hoursRequired) {
              await supabase.from("equipment_checkouts").delete().eq("id", inserted.id);
              return { id, err: { message: "Hours reading is required for this machine" } };
            }
          } else {
            const { error: hoursErr } = await supabase.rpc("record_equipment_hours", {
              p_equipment_id: id,
              p_checkout_id: inserted.id,
              p_hours_value: Number(raw),
            });
            if (hoursErr) {
              await supabase.from("equipment_checkouts").delete().eq("id", inserted.id);
              return { id, err: hoursErr };
            }
          }
        }
        return { id, err: null };
      })
    );
    setBusy(false);

    const failed = attempts.filter((a) => a.err);
    if (failed.length === 0) {
      onAllSucceeded?.();
      return;
    }

    const succeededIds = new Set(attempts.filter((a) => !a.err).map((a) => a.id));
    setCheckoutOutcome({
      succeeded: units.filter((u) => succeededIds.has(u.id)),
      failed: failed.map((f) => ({
        unit: units.find((u) => u.id === f.id),
        message: f.err.code === "23505" ? "Just taken by someone else" : f.err.message,
      })),
    });
    setView("results");
  }

  // Filing a fault for one selected-but-not-yet-checked-out unit -- same
  // RPC and same "no checkout to close" shape as reporting an issue on a
  // single ordinary checkout always has. Drops that unit from the
  // selection and the available list; if nothing's left selected, there's
  // nothing to confirm, so fall back to the units screen.
  async function handleReportIssue(unitId, description) {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("report_equipment_fault", {
      p_equipment_id: unitId,
      p_description: description,
      p_close_checkout_id: null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const jobId = (Array.isArray(data) ? data[0] : data)?.job_id;
    if (jobId) {
      supabase
        .from("jobs")
        .select("id, description, assignee_profile_id, assignee_group_id")
        .eq("id", jobId)
        .single()
        .then(({ data: newJob }) => {
          if (newJob) {
            notifyJobAssigned({ job: newJob, actorProfileId: profile.id, actorDisplayName: profile.display_name }).catch((err2) =>
              console.error("Failed to notify repair job assignee", err2)
            );
          }
        });
    }
    setReportingIssueFor(null);
    setUnits((prev) => prev.filter((u) => u.id !== unitId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(unitId);
      if (next.size === 0) setView("units");
      return next;
    });
  }

  return {
    view,
    setView,
    categories,
    selectedType,
    units,
    selectedIds,
    hoursByUnitId,
    setUnitHours,
    reportingIssueFor,
    setReportingIssueFor,
    checkoutOutcome,
    busy,
    error,
    openCategory,
    selectUnit,
    toggleUnit,
    backToCategories,
    handleCheckOut,
    handleReportIssue,
  };
}
