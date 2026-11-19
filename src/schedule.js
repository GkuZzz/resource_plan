const DAY = 86400000;
const utc = date => new Date(`${date}T00:00:00Z`).getTime();
const iso = date => date.toISOString().slice(0, 10);

export const shiftDate = (date, amount) => iso(new Date(utc(date) + amount * DAY));
export const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
export const overlaps = (a, b) => a.startDate <= b.endDate && a.endDate >= b.startDate;
export const assignmentSeriesKey = assignment => assignment.seriesId || `${assignment.employeeId}:${assignment.projectId}`;

const interruptAssignment = (assignment, priorityAssignment, createId) => {
  const seriesId = assignment.seriesId || assignment.id;
  const hasBefore = assignment.startDate < priorityAssignment.startDate;
  const result = [];
  if (hasBefore) {
    result.push({ ...assignment, seriesId, endDate: shiftDate(priorityAssignment.startDate, -1) });
  }

  const resumedStart = shiftDate(priorityAssignment.endDate, 1);
  const remainingDays = hasBefore
    ? (utc(assignment.endDate) - utc(priorityAssignment.startDate)) / DAY + 1
    : (utc(assignment.endDate) - utc(assignment.startDate)) / DAY + 1;
  result.push({
    ...assignment,
    seriesId,
    id: hasBefore ? createId() : assignment.id,
    startDate: resumedStart,
    endDate: shiftDate(resumedStart, remainingDays - 1),
  });
  return result;
};

export const applyPriorityAssignment = (assignments, priorityAssignment, previousId, createId = newId) => {
  const result = [];
  for (const assignment of assignments) {
    if (assignment.id === previousId) continue;
    const shouldInterrupt = assignment.employeeId === priorityAssignment.employeeId
      && assignment.projectId !== priorityAssignment.projectId
      && overlaps(assignment, priorityAssignment);
    if (!shouldInterrupt) {
      result.push(assignment);
      continue;
    }

    result.push(...interruptAssignment(assignment, priorityAssignment, createId));
  }
  return [...result, priorityAssignment];
};

export const scheduleAroundPriorities = (assignment, assignments, createId = newId) => {
  const priorities = assignments
    .filter(item => item.id !== assignment.id
      && item.allocationMode === 'priority'
      && item.employeeId === assignment.employeeId
      && item.projectId !== assignment.projectId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  let parts = [{ ...assignment, seriesId: assignment.seriesId || assignment.id }];
  for (const priority of priorities) {
    parts = parts.flatMap(part => overlaps(part, priority)
      ? interruptAssignment(part, priority, createId)
      : [part]);
  }
  return parts;
};

export const removeAssignmentSeries = (assignments, target) => {
  const seriesKey = assignmentSeriesKey(target);
  return assignments.filter(assignment => assignmentSeriesKey(assignment) !== seriesKey);
};

const getSeries = (assignments, target) => {
  const seriesKey = assignmentSeriesKey(target);
  const series = assignments
    .filter(assignment => assignmentSeriesKey(assignment) === seriesKey)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const rest = assignments.filter(assignment => assignmentSeriesKey(assignment) !== seriesKey);
  const duration = series.reduce((total, assignment) => total + (utc(assignment.endDate) - utc(assignment.startDate)) / DAY + 1, 0);
  return { series, rest, duration };
};

const rebuildSeries = (series, rest, startDate, duration, createId) => {
  const first = series[0];
  const combined = {
    ...first,
    seriesId: first.seriesId || first.id,
    startDate,
    endDate: shiftDate(startDate, duration - 1),
  };
  return combined.allocationMode === 'priority'
    ? applyPriorityAssignment(rest, combined, undefined, createId)
    : [...rest, ...scheduleAroundPriorities(combined, rest, createId)];
};

export const moveAssignmentSeries = (assignments, target, delta, createId = newId) => {
  const { series, rest, duration } = getSeries(assignments, target);
  return rebuildSeries(series, rest, shiftDate(series[0].startDate, delta), duration, createId);
};

export const resizeAssignmentSeries = (assignments, target, mode, delta, createId = newId) => {
  const { series, rest, duration } = getSeries(assignments, target);
  const startDate = mode === 'start' ? shiftDate(series[0].startDate, delta) : series[0].startDate;
  const nextDuration = Math.max(1, mode === 'start' ? duration - delta : duration + delta);
  return rebuildSeries(series, rest, startDate, nextDuration, createId);
};
