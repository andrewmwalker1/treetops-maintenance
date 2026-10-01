// An activity type's optional minimum crew size (task_types.min_people,
// 82-activity-type-min-people.sql), e.g. Ladders: 2. A job with several
// activity types needs the largest of their minimums.

// The minimum for a job's activity types, and which of them set it -- or
// null when none of them has one.
export function minimumPeopleFor(activityTypes) {
  const withMin = (activityTypes || []).filter((t) => Number.isInteger(t.min_people) && t.min_people >= 1);
  if (withMin.length === 0) return null;
  const count = Math.max(...withMin.map((t) => t.min_people));
  return { count, typeNames: withMin.filter((t) => t.min_people === count).map((t) => t.name) };
}

// "This job requires a minimum of 2 people (Ladders)."
export function minimumPeopleMessage(activityTypes) {
  const min = minimumPeopleFor(activityTypes);
  if (!min) return null;
  return `This job requires a minimum of ${min.count} ${min.count === 1 ? "person" : "people"} (${min.typeNames.join(", ")}).`;
}
