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
    const hasAfter = assignment.endDate > priorityAssignment.endDate;
    if (hasBefore) {
      result.push({ ...assignment, endDate: shiftDate(priorityAssignment.startDate, -1) });
    }
    if (hasAfter) {
      result.push({
        ...assignment,
        id: hasBefore ? createId() : assignment.id,
        startDate: shiftDate(priorityAssignment.endDate, 1),
      });
    }
  }
  return [...result, priorityAssignment];
};
