// Shared equipment check-in state machine: list -> confirm, plus the
// inline "report an issue instead" branch. Originally lived entirely
// inside KioskCheckIn.jsx; pulled out so the main app's own Checkin Kit
// page (CheckinKit.jsx, reachable from staff's own phones without a
// workshop kiosk terminal) runs the exact same logic rather than a
// hand-copied second version that drifts over time -- same split as
// useEquipmentCheckout.js/CheckoutKit.jsx. Each caller supplies its own
// JSX/styling -- this only owns state and writes.
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";
import { notifyJobAssigned } from "./jobAssignmentNotify.js";

export function useEquipmentCheckin() {
  const { profile } = useAuth();
  const [view, setView] = useState("list"); // list | confirm
  const [checkouts, setCheckouts] = useState([]);
  // Ticked multi-checkout-type items on the list screen, or the single
  // item tapped directly -- the confirm screen below doesn't distinguish
  // the two, only the list screen's row rendering does (checkbox vs a
  // plain tap-through button).
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reportingIssueFor, setReportingIssueFor] = useState(null); // checkout id, or null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Fetches each checked-out item's equipment type's RA/MS documents in a
  // second pass (same "junction table, then merge in JS" approach as
  // getEquipmentTypeAvailabilityCounts) so the confirm screen can show a
  // Health & Safety list for whatever's being checked in, same as the
  // check-out flow already does for the type being taken.
  const refresh = useCallback(() => {
    if (!profile) return;
    supabase
      .from("equipment_checkouts")
      .select("id, checked_out_at, equipment:equipment(id, name, equipment_type_id, equipment_type:equipment_types(id, name, allow_multi_checkout))")
      .eq("profile_id", profile.id)
      .is("checked_in_at", null)
      .order("checked_out_at")
      .then(async ({ data, error: err }) => {
        if (err) {
          setError(err.message);
          return;
        }
        const rows = data || [];
        const typeIds = [...new Set(rows.map((c) => c.equipment.equipment_type_id).filter(Boolean))];
        const documentsByType = {};
        if (typeIds.length > 0) {
          const { data: docLinks } = await supabase
            .from("equipment_type_documents")
            .select("equipment_type_id, document:ra_ms_documents(id, type, title, description, pdf_storage_path)")
            .in("equipment_type_id", typeIds);
          for (const link of docLinks || []) {
            (documentsByType[link.equipment_type_id] ||= []).push(link.document);
          }
          for (const docs of Object.values(documentsByType)) {
            docs.sort((a, b) => a.title.localeCompare(b.title));
          }
        }
        setCheckouts(
          rows.map((c) => ({
            ...c,
            equipment: {
              ...c.equipment,
              equipment_type: c.equipment.equipment_type
                ? { ...c.equipment.equipment_type, documents: documentsByType[c.equipment.equipment_type_id] || [] }
                : c.equipment.equipment_type,
            },
          }))
        );
      });
  }, [profile]);

  useEffect(refresh, [refresh]);

  function toggleSelect(checkoutId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(checkoutId)) next.delete(checkoutId);
      else next.add(checkoutId);
      return next;
    });
  }

  // Ordinary (non multi-checkout) flow: tapping an item goes straight to
  // confirm, same as before multi check-in existed.
  function openSingle(c) {
    setError(null);
    setReportingIssueFor(null);
    setSelectedIds(new Set([c.id]));
    setView("confirm");
  }

  function proceedWithSelected() {
    if (selectedIds.size === 0) return;
    setError(null);
    setReportingIssueFor(null);
    setView("confirm");
  }

  function backToList() {
    setView("list");
    setSelectedIds(new Set());
    setReportingIssueFor(null);
  }

  // Best-effort, same reasoning as useEquipmentCheckout's handleCheckOut --
  // each selected checkout is closed independently.
  async function handleConfirmClean() {
    setBusy(true);
    setError(null);
    const ids = [...selectedIds];
    const attempts = await Promise.all(
      ids.map(async (id) => {
        const { error: err } = await supabase
          .from("equipment_checkouts")
          .update({ checked_in_at: new Date().toISOString(), checked_in_by: profile.id })
          .eq("id", id);
        return { id, err };
      })
    );
    setBusy(false);
    const failed = attempts.filter((a) => a.err);
    if (failed.length > 0) {
      setError(failed.map((f) => f.err.message).join("; "));
    }
    setSelectedIds(new Set());
    setView("list");
    refresh();
  }

  async function handleReportIssue(checkoutId, description) {
    const checkout = checkouts.find((c) => c.id === checkoutId);
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("report_equipment_fault", {
      p_equipment_id: checkout.equipment.id,
      p_description: description,
      p_close_checkout_id: checkoutId,
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(checkoutId);
      if (next.size === 0) setView("list");
      return next;
    });
    refresh();
  }

  return {
    view,
    setView,
    checkouts,
    selectedIds,
    reportingIssueFor,
    setReportingIssueFor,
    busy,
    error,
    toggleSelect,
    openSingle,
    proceedWithSelected,
    backToList,
    handleConfirmClean,
    handleReportIssue,
  };
}
