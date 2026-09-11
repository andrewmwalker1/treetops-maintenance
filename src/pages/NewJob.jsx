import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { queueJob } from "../platform/syncQueue.js";
import { capturePhoto } from "../platform/camera.js";
import { notifyJobAssigned } from "../lib/jobAssignmentNotify.js";
import { getAssignableTargets } from "../lib/assignableTargets.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
import SearchPicker from "../components/SearchPicker.jsx";
import ActivityTypePicker from "../components/ActivityTypePicker.jsx";
import { colors } from "../lib/theme.js";
import {
  Alert,
  Button,
  Card,
  Chip,
  Field,
  Fieldset,
  IconOffline,
  Input,
  Modal,
  ModalFooter,
  PageHeader,
  Pill,
  Select,
  Textarea,
} from "../ui/index.js";

// The three groupings a job's fields fall into -- see NewJob's design
// critique (.impeccable/critique/) for why this replaced one flat list of
// 10+ fields: a one-handed, outdoor, often-interrupted user scans each step
// as one decision at a time instead of the whole form at once.
const STEPS = ["What", "Who & where", "Evidence"];

export default function NewJob() {
  const { profile, org, activeSite, terminology } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const canEditChecklist = permissions.has("can_edit_job_checklist");
  const canRequirePhoto = permissions.has("can_require_job_photo");
  // Distinct from canRequirePhoto above -- that one is the whole-job "at
  // least one photo before completing" flag; this gates the per-checklist
  // -item camera toggle in ChecklistBuilder (see
  // 32-checklist-item-photo-requirement.sql for why they're separate).
  const canRequireChecklistItemPhoto = permissions.has("can_require_checklist_item_photo");
  // Same gating as JobDetail's identical buttons -- job_types insert/update
  // is RLS-gated on can_manage_reference_data separately from
  // can_edit_job_checklist, so require both or the server rejects it.
  const canManageTemplates = permissions.has("can_edit_job_checklist") && permissions.has("can_manage_reference_data");

  const [jobTypes, setJobTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [defaultActivitiesByType, setDefaultActivitiesByType] = useState({}); // job_type_id -> [task_type_id]
  const [recentJobTypeIds, setRecentJobTypeIds] = useState([]);

  const [step, setStep] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [description, setDescription] = useState("");
  const [jobTypeId, setJobTypeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeKind, setAssigneeKind] = useState("person"); // person | group
  const [assigneeId, setAssigneeId] = useState("");
  const [locationKind, setLocationKind] = useState("pitch"); // pitch | area | none
  const [locationId, setLocationId] = useState("");
  const [areaName, setAreaName] = useState("");
  const [activityTypeIds, setActivityTypeIds] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [photos, setPhotos] = useState([]); // [{ file, previewUrl }]
  const [photoError, setPhotoError] = useState(null);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!org || !activeSite) return;
    supabase.from("job_types").select("id, name, template_schema").eq("org_id", org.id).then(({ data }) => setJobTypes(data || []));
    supabase.from("job_statuses").select("id, name, sort_order").eq("org_id", org.id).order("sort_order").then(({ data }) => setStatuses(data || []));
    getAssignableTargets(org.id, profile.role_id).then(({ people: p, groups: g, error: assignErr }) => {
      setPeople(p);
      setGroups(g);
      if (assignErr) setSubmitError(`Couldn't load people/groups to assign to: ${assignErr}`);
    });
    supabase.from("contractors").select("id, name").eq("org_id", org.id).order("name").then(({ data }) => setContractors(data || []));
    supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).then(({ data }) => setPitches(data || []));
    supabase.from("areas").select("id, name").eq("site_id", activeSite.id).then(({ data }) => setAreas(data || []));
    supabase.from("task_types").select("id, name").eq("org_id", org.id).then(({ data }) => setActivityTypes(data || []));
    supabase.from("job_type_task_types").select("job_type_id, task_type_id").then(({ data }) => {
      const grouped = {};
      for (const link of data || []) {
        grouped[link.job_type_id] = [...(grouped[link.job_type_id] || []), link.task_type_id];
      }
      setDefaultActivitiesByType(grouped);
    });
  }, [org, activeSite]);

  // The last few *distinct* job templates this person has actually used --
  // shown as one-tap chips above the search box so a repeat job (the same
  // 2-3 templates most days) doesn't need reopening a full list every time.
  useEffect(() => {
    if (!org || !profile) return;
    supabase
      .from("jobs")
      .select("job_type_id, created_at")
      .eq("org_id", org.id)
      .eq("created_by", profile.id)
      .not("job_type_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const seen = new Set();
        const ids = [];
        for (const row of data || []) {
          if (seen.has(row.job_type_id)) continue;
          seen.add(row.job_type_id);
          ids.push(row.job_type_id);
          if (ids.length === 3) break;
        }
        setRecentJobTypeIds(ids);
      });
  }, [org, profile]);

  // navigator.onLine only tells you the state at the moment you read it --
  // these events are what keep the offline chip (and the submit-time queue
  // check below) current while the user is sitting on this form.
  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const recentTemplates = jobTypes
    .filter((jt) => recentJobTypeIds.includes(jt.id))
    .sort((a, b) => recentJobTypeIds.indexOf(a.id) - recentJobTypeIds.indexOf(b.id));

  function handleJobTypeChange(newJobTypeId) {
    setJobTypeId(newJobTypeId);
    const jobType = jobTypes.find((jt) => jt.id === newJobTypeId);
    // Don't clobber a description the user has already started typing.
    setDescription((current) => (current.trim() ? current : jobType?.name || ""));
    setChecklistItems(jobType?.template_schema || []);
    setActivityTypeIds(defaultActivitiesByType[newJobTypeId] || []);
  }

  function toggleActivityType(id) {
    setActivityTypeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function goToStep(next) {
    setSubmitError(null);
    setStep(next);
  }

  function handleContinueFromWhat() {
    if (!description.trim()) {
      setSubmitError("Add a description before continuing.");
      return;
    }
    goToStep(1);
  }

  async function handleSaveAsTemplate(e) {
    e.preventDefault();
    const name = newTemplateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    const { error: err } = await supabase.from("job_types").insert({
      org_id: org.id,
      name,
      template_schema: checklistItems,
    });
    setSavingTemplate(false);
    if (err) {
      setSubmitError(err.message);
      return;
    }
    setShowSaveAsModal(false);
    setNewTemplateName("");
  }

  async function handleUpdateTemplate() {
    const jobType = jobTypes.find((jt) => jt.id === jobTypeId);
    if (!jobType) return;
    const proceed = window.confirm(
      `Update the "${jobType.name}" template's checklist to match what's shown here? This changes the default checklist for any new jobs created from this template from now on.`
    );
    if (!proceed) return;
    const { error: err } = await supabase.from("job_types").update({ template_schema: checklistItems }).eq("id", jobType.id);
    if (err) {
      setSubmitError(err.message);
      return;
    }
    setJobTypes((prev) => prev.map((jt) => (jt.id === jobType.id ? { ...jt, template_schema: checklistItems } : jt)));
  }

  async function handleAddPhoto() {
    setPhotoError(null);
    try {
      const file = await capturePhoto();
      setPhotos((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
    } catch (err) {
      if (err.message !== "Photo capture cancelled.") setPhotoError(err.message);
    }
  }

  function handleRemovePhoto(index) {
    setPhotos((prev) => {
      if (prev[index]) URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function uploadPhotoForJob(jobId, file) {
    const path = `${jobId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, file);
    if (uploadError) throw uploadError;
    const { error: insertError } = await supabase.from("job_photos").insert({
      job_id: jobId,
      storage_path: path,
      uploaded_by: profile.id,
    });
    if (insertError) throw insertError;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    // Description lives on step 1 ("What"), which may no longer be
    // mounted by the time this fires from step 3's submit button -- so the
    // Textarea's own `required` attribute can't be relied on to catch this.
    if (!description.trim()) {
      setStep(0);
      setSubmitError("Add a description before creating the job.");
      return;
    }

    // job_statuses hasn't finished loading yet — submitting now would send
    // a request with no status_id (a required column) and fail. Rather
    // than let that happen silently, stop and ask the user to wait a
    // moment rather than mask it as a queued/offline save.
    if (statuses.length === 0) {
      setSubmitError("Still loading — please wait a moment and try again.");
      return;
    }
    const openStatus = statuses.find((s) => s.sort_order === Math.min(...statuses.map((x) => x.sort_order)));
    if (!openStatus) {
      setSubmitError("Couldn't determine the default status for a new job. Try again, or contact support.");
      return;
    }

    // Areas are free text (see areas table) -- resolve the typed name to an
    // existing area or create a new one, rather than requiring the user to
    // pick from a fixed list.
    let areaId = null;
    let resolvedAreaName = null;
    if (locationKind === "area" && areaName.trim()) {
      const trimmed = areaName.trim();
      const existing = areas.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        areaId = existing.id;
        resolvedAreaName = existing.name;
      } else if (!navigator.onLine) {
        setStep(1);
        setSubmitError("That's a new area and you're offline -- pick an existing one from the list, or try again once you're back online.");
        return;
      } else {
        const { data: newArea, error: areaError } = await supabase
          .from("areas")
          .insert({ site_id: activeSite.id, name: trimmed, created_by: profile.id })
          .select()
          .single();
        if (areaError) {
          setStep(1);
          setSubmitError("Failed to save the new area: " + areaError.message);
          return;
        }
        areaId = newArea.id;
        resolvedAreaName = newArea.name;
        setAreas((prev) => [...prev, newArea]);
      }
    }

    setSubmitting(true);

    const jobData = {
      id: crypto.randomUUID(),
      org_id: org.id,
      site_id: activeSite.id,
      job_type_id: jobTypeId || null,
      description,
      priority,
      status_id: openStatus.id,
      due_date: dueDate || null,
      assignee_profile_id: assigneeKind === "person" && assigneeId ? assigneeId : null,
      assignee_group_id: assigneeKind === "group" && assigneeId ? assigneeId : null,
      assignee_contractor_id: assigneeKind === "contractor" && assigneeId ? assigneeId : null,
      pitch_id: locationKind === "pitch" && locationId ? locationId : null,
      area_id: areaId,
      created_by: profile.id,
      requires_photo: canRequirePhoto && requiresPhoto,
    };

    // Built once up front so every exit path (straight through, queued
    // offline, queued after a failed online attempt) can hand JobsList the
    // same specific "what just happened" summary -- matching the care the
    // error/offline copy on this screen already gets, instead of a silent
    // navigate that leaves the user unsure which job they just made.
    const locationLabel = jobData.pitch_id
      ? `${terminology.pitch || "Pitch"} ${pitches.find((p) => p.id === jobData.pitch_id)?.pitch_number_or_name || ""}`.trim()
      : resolvedAreaName;
    const assigneeLabel = jobData.assignee_profile_id
      ? people.find((p) => p.id === jobData.assignee_profile_id)?.display_name
      : jobData.assignee_group_id
      ? groups.find((g) => g.id === jobData.assignee_group_id)?.name
      : jobData.assignee_contractor_id
      ? contractors.find((c) => c.id === jobData.assignee_contractor_id)?.name
      : null;
    const summaryDetails = [locationLabel, assigneeLabel ? `assigned to ${assigneeLabel}` : null].filter(Boolean).join(", ");
    const summary = summaryDetails ? `${description} — ${summaryDetails}` : description;
    const queuedNote =
      photos.length > 0
        ? ` (${photos.length === 1 ? "the photo" : "photos"} will need to be added again, from the job's detail screen, once it syncs)`
        : "";

    if (!navigator.onLine) {
      await queueJob(jobData);
      navigate("/", { state: { justCreated: { id: jobData.id, tone: "warn", title: "Saved for later", summary: `${summary}${queuedNote}` } } });
      setSubmitting(false);
      return;
    }

    try {
      // Plain insert with no RETURNING (no .select()) -- with RETURNING,
      // Postgres re-checks the jobs_select RLS policy (can_see_job, which
      // re-queries jobs by id) against the row being inserted in the same
      // statement, and that self-referencing lookup unreliably fails to
      // see the row within the same command, throwing a spurious
      // "violates row-level security policy" error even though the row is
      // written and fully visible to a subsequent query. Generating the id
      // client-side sidesteps this entirely -- no need to read it back.
      const { error } = await supabase.from("jobs").insert(jobData);
      if (error) throw error;

      // Best-effort follow-up writes — the job itself is already
      // created, so a failure here shouldn't block navigation.
      if (jobData.assignee_profile_id || jobData.assignee_group_id || jobData.assignee_contractor_id) {
        notifyJobAssigned({ job: jobData, actorProfileId: profile.id, actorDisplayName: profile.display_name }).catch((err) =>
          console.error("Failed to send job-assignment notification", err)
        );
      }
      for (const { file } of photos) {
        try {
          await uploadPhotoForJob(jobData.id, file);
        } catch (photoErr) {
          console.error("Failed to attach photo to new job", photoErr);
        }
      }
      if (activityTypeIds.length > 0) {
        const { error: activityError } = await supabase
          .from("job_activity_types")
          .insert(activityTypeIds.map((task_type_id) => ({ job_id: jobData.id, task_type_id })));
        if (activityError) console.error("Failed to attach activity types to new job", activityError);
      }
      if (checklistItems.length > 0) {
        // A heading row (see ChecklistBuilder.jsx) is never itself a real
        // checklist item -- it just names the section for whatever items
        // follow it, up to the next heading (or the end of the list).
        let currentSection = null;
        const subtaskRows = [];
        for (const item of checklistItems) {
          if (item.type === "heading") {
            currentSection = item.label;
            continue;
          }
          subtaskRows.push({
            job_id: jobData.id,
            label: item.label,
            requires_photo: item.requiresPhoto,
            section: currentSection,
            sort_order: subtaskRows.length,
          });
        }
        if (subtaskRows.length > 0) {
          const { error: checklistError } = await supabase.from("job_subtasks").insert(subtaskRows);
          if (checklistError) console.error("Failed to attach checklist to new job", checklistError);
        }
      }
      navigate("/", { state: { justCreated: { id: jobData.id, tone: "ok", title: "Job created", summary } } });
    } catch (err) {
      // Only genuine network failures get queued for later sync — a real
      // rejection from the server (permission denied, bad data, etc.)
      // would just fail the same way on retry, so surface it instead of
      // hiding it behind a misleading "queued" message.
      if (err instanceof TypeError) {
        console.error("Network error creating job, queueing for later sync", err);
        await queueJob(jobData);
        navigate("/", { state: { justCreated: { id: jobData.id, tone: "warn", title: "Saved for later", summary: `${summary}${queuedNote}` } } });
      } else {
        console.error("Failed to create job", err);
        setSubmitError(err.message || "Failed to create job.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!org || !activeSite) return null;

  return (
    <div style={{ maxWidth: "var(--width-lg)" }}>
      <PageHeader title="New job" />
      <Card as="form" onSubmit={handleSubmit} pad="lg">
        {!isOnline && (
          <Pill tone="warn" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
            <IconOffline size={11} />
            Offline — will save once you're back online
          </Pill>
        )}

        <div style={{ display: "flex", gap: "var(--space-1)", marginBottom: "var(--space-2)" }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ flex: 1, height: "4px", borderRadius: "var(--radius-full)", background: i <= step ? colors.moss : colors.line }} />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "var(--text-xs)",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-label)",
            color: colors.inkSoft,
            marginBottom: "var(--space-5)",
          }}
        >
          {STEPS.map((label, i) => (
            <span key={label} style={i === step ? { color: colors.moss, fontWeight: 600 } : undefined}>
              {i + 1}. {label}
            </span>
          ))}
        </div>

        <Fieldset>
          {step === 0 && (
            <>
              <Field label="Job template (optional)">
                {({ id }) => (
                  <>
                    {recentTemplates.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                        {recentTemplates.map((jt) => (
                          <Chip key={jt.id} active={jobTypeId === jt.id} onClick={() => handleJobTypeChange(jt.id)}>
                            {jt.name}
                          </Chip>
                        ))}
                      </div>
                    )}
                    <SearchPicker
                      id={id}
                      items={jobTypes}
                      value={jobTypeId}
                      onChange={handleJobTypeChange}
                      placeholder="Type to search job templates…"
                      ariaLabel="Job template"
                    />
                  </>
                )}
              </Field>

              <Field label="Description" required>
                {({ id }) => (
                  <Textarea id={id} required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                )}
              </Field>

              <Field label="Activity types (optional)">
                {activityTypes.length === 0 ? (
                  <span style={{ color: colors.inkSoft, fontSize: "var(--text-base)" }}>None set up yet.</span>
                ) : (
                  <ActivityTypePicker allTypes={activityTypes} selectedIds={activityTypeIds} onToggle={toggleActivityType} />
                )}
              </Field>

              <Field label="Checklist">
                <Card pad="sm">
                  <ChecklistBuilder
                    items={checklistItems}
                    onChange={setChecklistItems}
                    readOnly={!canEditChecklist}
                    canRequirePhoto={canRequireChecklistItemPhoto}
                  />
                  {!canEditChecklist && checklistItems.length === 0 && (
                    <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)", margin: 0 }}>
                      Pick a job template above to attach its checklist.
                    </p>
                  )}
                  {canManageTemplates && (
                    <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
                      <Button size="sm" onClick={() => setShowSaveAsModal(true)}>
                        Save as new template
                      </Button>
                      {jobTypeId && (
                        <Button size="sm" onClick={handleUpdateTemplate}>
                          Update "{jobTypes.find((jt) => jt.id === jobTypeId)?.name}" template
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Priority">
                {({ id }) => (
                  <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="immediate">Immediate</option>
                  </Select>
                )}
              </Field>

              <Field label="Due date (optional)">
                {({ id }) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
              </Field>

              <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
                <legend className="tt-field__label" style={{ padding: 0 }}>Assign to</legend>
                <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
                  <label>
                    <input
                      type="radio"
                      name="assigneeKind"
                      checked={assigneeKind === "person"}
                      onChange={() => {
                        setAssigneeKind("person");
                        setAssigneeId("");
                      }}
                    />{" "}
                    Person
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="assigneeKind"
                      checked={assigneeKind === "group"}
                      onChange={() => {
                        setAssigneeKind("group");
                        setAssigneeId("");
                      }}
                    />{" "}
                    Group
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="assigneeKind"
                      checked={assigneeKind === "contractor"}
                      onChange={() => {
                        setAssigneeKind("contractor");
                        setAssigneeId("");
                      }}
                    />{" "}
                    Contractor
                  </label>
                </div>
                <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="Assign to">
                  <option value="">Unassigned</option>
                  {(assigneeKind === "person" ? people : assigneeKind === "group" ? groups : contractors).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.display_name || item.name}
                    </option>
                  ))}
                </Select>
              </fieldset>

              <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
                <legend className="tt-field__label" style={{ padding: 0 }}>Location</legend>
                <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
                  <label>
                    <input
                      type="radio"
                      name="locationKind"
                      checked={locationKind === "pitch"}
                      onChange={() => {
                        setLocationKind("pitch");
                        setLocationId("");
                        setAreaName("");
                      }}
                    />{" "}
                    {terminology.pitch || "Pitch"}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="locationKind"
                      checked={locationKind === "area"}
                      onChange={() => {
                        setLocationKind("area");
                        setLocationId("");
                        setAreaName("");
                      }}
                    />{" "}
                    {terminology.area || "Area"}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="locationKind"
                      checked={locationKind === "none"}
                      onChange={() => {
                        setLocationKind("none");
                        setLocationId("");
                        setAreaName("");
                      }}
                    />{" "}
                    None
                  </label>
                </div>
                {locationKind === "pitch" && (
                  <SearchPicker
                    items={pitches}
                    getLabel={(p) => p.pitch_number_or_name}
                    value={locationId}
                    onChange={setLocationId}
                    placeholder="Type to search pitches…"
                    ariaLabel={terminology.pitch || "Pitch"}
                  />
                )}
                {locationKind === "area" && (
                  <>
                    <Input
                      list="area-suggestions"
                      value={areaName}
                      onChange={(e) => setAreaName(e.target.value)}
                      placeholder={`Type a ${(terminology.area || "area").toLowerCase()} name…`}
                      aria-label={terminology.area || "Area"}
                    />
                    <datalist id="area-suggestions">
                      {areas.map((a) => (
                        <option key={a.id} value={a.name} />
                      ))}
                    </datalist>
                  </>
                )}
              </fieldset>
            </>
          )}

          {step === 2 && (
            <>
              {canRequirePhoto && (
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-base)" }}>
                  <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} />
                  Require a photo before this job can be completed
                </label>
              )}

              <Field label="Photos (optional)" error={photoError}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  {photos.map((p, i) => (
                    <div key={p.previewUrl} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)" }}>
                      <img
                        src={p.previewUrl}
                        alt={`Attached photo ${i + 1} of ${photos.length}`}
                        style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                      />
                      <Button size="sm" onClick={() => handleRemovePhoto(i)}>Remove</Button>
                    </div>
                  ))}
                  <Button onClick={handleAddPhoto}>Add photo</Button>
                </div>
              </Field>

              {submitError && (
                <Alert tone="danger" title="Could not create the job">
                  {submitError}
                </Alert>
              )}
            </>
          )}

          {submitError && step !== 2 && (
            <Alert tone="danger" title="Couldn't continue">
              {submitError}
            </Alert>
          )}

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              justifyContent: step === 0 ? "flex-end" : "space-between",
              position: "sticky",
              bottom: 0,
              background: colors.paper,
              paddingTop: "var(--space-4)",
              borderTop: `1px solid ${colors.line}`,
            }}
          >
            {step > 0 && (
              <Button type="button" onClick={() => goToStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 2 && (
              <Button type="button" variant="primary" onClick={step === 0 ? handleContinueFromWhat : () => goToStep(2)}>
                Continue
              </Button>
            )}
            {step === 2 && (
              <Button type="submit" variant="primary" loading={submitting} style={{ flex: 1 }}>
                {submitting ? "Saving…" : "Create job"}
              </Button>
            )}
          </div>
        </Fieldset>
      </Card>

      {showSaveAsModal && (
        <Modal title="Save as new template" onClose={() => setShowSaveAsModal(false)}>
          <form onSubmit={handleSaveAsTemplate}>
            <Field label="Template name" required>
              {({ id }) => (
                <Input id={id} autoFocus required value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} />
              )}
            </Field>
            <ModalFooter>
              <Button onClick={() => setShowSaveAsModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={savingTemplate}>
                {savingTemplate ? "Saving…" : "Save"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  );
}
