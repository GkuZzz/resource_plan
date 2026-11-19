const DAY = 86400000;
const utc = date => new Date(`${date}T00:00:00Z`).getTime();
const iso = date => date.toISOString().slice(0, 10);

export const shiftDate = (date, amount) => iso(new Date(utc(date) + amount * DAY));
export const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
export const overlaps = (a, b) => a.startDate <= b.endDate && a.endDate >= b.startDate;

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

    const hasBefore = assignment.startDate < priorityAssignment.startDate;
    if (hasBefore) {
      result.push({ ...assignment, endDate: shiftDate(priorityAssignment.startDate, -1) });
    }

    const resumedStart = shiftDate(priorityAssignment.endDate, 1);
    const remainingDays = hasBefore
      ? (utc(assignment.endDate) - utc(priorityAssignment.startDate)) / DAY + 1
      : (utc(assignment.endDate) - utc(assignment.startDate)) / DAY + 1;
    result.push({
      ...assignment,
      id: hasBefore ? createId() : assignment.id,
      startDate: resumedStart,
      endDate: shiftDate(resumedStart, remainingDays - 1),
    });
  }
  return [...result, priorityAssignment];
};
