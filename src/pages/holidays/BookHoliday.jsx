// Container for the calendar -> review flow. Loads what the calendar
// needs to grey days out (work pattern, bank holidays, days already
// covered by a live request) once, then swaps between the two steps
// without re-fetching.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getBankHolidays, getMyHolidayRequests, getStaffTimeProfile } from "../../lib/holidayQueries.js";
import { Alert, SkeletonList } from "../../ui/index.js";
import BookingCalendar from "./BookingCalendar.jsx";
import BookingReview from "./BookingReview.jsx";

export default function BookHoliday() {
  const { profile } = useAuth();
  const [timeProfile, setTimeProfile] = useState(null);
  const [bankHolidays, setBankHolidays] = useState([]);
  const [existingRequests, setExistingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDates, setSelectedDates] = useState([]);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    Promise.all([getStaffTimeProfile(profile.id), getBankHolidays(), getMyHolidayRequests(profile.id)])
      .then(([tp, bh, reqs]) => {
        setTimeProfile(tp);
        setBankHolidays(bh);
        setExistingRequests(reqs);
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [profile]);

  const bankHolidayDates = useMemo(() => new Set(bankHolidays.map((b) => b.holiday_date)), [bankHolidays]);

  // Anything not already declined -- pending or approved -- blocks
  // re-selecting the same day client-side. The database's own partial
  // unique index on timesheet_entries is the real guarantee; this just
  // doesn't invite the attempt.
  const alreadyRequestedDates = useMemo(() => {
    const set = new Set();
    for (const r of existingRequests) {
      if (r.status === "declined") continue;
      for (const d of r.days) set.add(d.work_date);
    }
    return set;
  }, [existingRequests]);

  function toggleDate(iso) {
    setSelectedDates((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()));
  }

  function handleSubmitted() {
    setSelectedDates([]);
    setReviewing(false);
    if (profile) getMyHolidayRequests(profile.id).then(setExistingRequests);
  }

  if (loading) return <SkeletonList rows={3} height={60} />;
  if (error) return <Alert tone="danger" title="Something went wrong">{error}</Alert>;

  if (!timeProfile) {
    return (
      <Alert tone="info" title="Not set up yet">
        Your work pattern hasn't been configured yet — ask the office to set this up before you can book holiday.
      </Alert>
    );
  }

  if (reviewing) {
    return (
      <BookingReview
        profileId={profile.id}
        timeProfile={timeProfile}
        dates={selectedDates}
        onBack={() => setReviewing(false)}
        onSubmitted={handleSubmitted}
      />
    );
  }

  return (
    <BookingCalendar
      timeProfile={timeProfile}
      bankHolidayDates={bankHolidayDates}
      disabledDates={alreadyRequestedDates}
      selectedDates={selectedDates}
      onToggleDate={toggleDate}
      onContinue={() => setReviewing(true)}
    />
  );
}
