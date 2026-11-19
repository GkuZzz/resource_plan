import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPriorityAssignment, moveAssignmentSeries, removeAssignmentSeries, scheduleAroundPriorities } from './schedule.js';

const assignment = {
  id: 'base',
  employeeId: 'alex',
  projectId: 'lkk',
  startDate: '2027-01-01',
  endDate: '2027-12-31',
};

const priority = {
  id: 'priority',
  employeeId: 'alex',
  projectId: 'fast',
  startDate: '2027-03-01',
  endDate: '2027-03-31',
  allocationMode: 'priority',
};

test('splits an overlapping assignment around a priority interval', () => {
  const result = applyPriorityAssignment([assignment], priority, undefined, () => 'right');
  assert.deepEqual(result, [
    { ...assignment, seriesId: 'base', endDate: '2027-02-28' },
    { ...assignment, seriesId: 'base', id: 'right', startDate: '2027-04-01', endDate: '2028-01-31' },
    priority,
  ]);
});

test('moves a fully covered assignment after the priority interval', () => {
  const covered = { ...assignment, startDate: '2027-03-10', endDate: '2027-03-20' };
  assert.deepEqual(applyPriorityAssignment([covered], priority), [
    { ...covered, seriesId: 'base', startDate: '2027-04-01', endDate: '2027-04-11' },
    priority,
  ]);
});

test('resumes unfinished work when the original end falls inside the priority interval', () => {
  const interrupted = { ...assignment, startDate: '2027-02-01', endDate: '2027-03-15' };
  assert.deepEqual(applyPriorityAssignment([interrupted], priority, undefined, () => 'continued'), [
    { ...interrupted, seriesId: 'base', endDate: '2027-02-28' },
    { ...interrupted, seriesId: 'base', id: 'continued', startDate: '2027-04-01', endDate: '2027-04-15' },
    priority,
  ]);
});

test('does not interrupt another employee or the same project', () => {
  const otherEmployee = { ...assignment, id: 'other', employeeId: 'maria' };
  const sameProject = { ...assignment, id: 'same', projectId: 'fast' };
  assert.deepEqual(applyPriorityAssignment([otherEmployee, sameProject], priority), [otherEmployee, sameProject, priority]);
});

test('keeps a moved parallel assignment outside an existing priority interval', () => {
  const moved = { ...assignment, startDate: '2027-02-15', endDate: '2027-03-15', allocationMode: 'parallel' };
  assert.deepEqual(scheduleAroundPriorities(moved, [priority], () => 'continued'), [
    { ...moved, seriesId: 'base', endDate: '2027-02-28' },
    { ...moved, seriesId: 'base', id: 'continued', startDate: '2027-04-01', endDate: '2027-04-15' },
  ]);
});

test('deletes every linked part of a split assignment', () => {
  const parts = [
    { ...assignment, seriesId: 'series', endDate: '2027-02-28' },
    { ...assignment, id: 'continued', seriesId: 'series', startDate: '2027-04-01' },
    priority,
  ];
  assert.deepEqual(removeAssignmentSeries(parts, parts[1]), [priority]);
});

test('groups legacy split parts by employee and project when seriesId is absent', () => {
  const legacyPart = { ...assignment, id: 'legacy-part', startDate: '2027-04-01' };
  assert.deepEqual(removeAssignmentSeries([assignment, legacyPart, priority], legacyPart), [priority]);
});

test('moves linked parts as one series and keeps them outside a priority interval', () => {
  const parts = [
    { ...assignment, seriesId: 'series', endDate: '2027-02-28' },
    { ...assignment, id: 'continued', seriesId: 'series', startDate: '2027-04-01', endDate: '2027-04-15' },
  ];
  assert.deepEqual(moveAssignmentSeries([...parts, priority], parts[0], 10, () => 'resumed'), [
    priority,
    { ...assignment, seriesId: 'series', startDate: '2027-01-11', endDate: '2027-02-28' },
    { ...assignment, seriesId: 'series', id: 'resumed', startDate: '2027-04-01', endDate: '2027-04-25' },
  ]);
});
