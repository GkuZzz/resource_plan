import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPriorityAssignment } from './schedule.js';

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
    { ...assignment, endDate: '2027-02-28' },
    { ...assignment, id: 'right', startDate: '2027-04-01', endDate: '2028-01-31' },
    priority,
  ]);
});

test('moves a fully covered assignment after the priority interval', () => {
  const covered = { ...assignment, startDate: '2027-03-10', endDate: '2027-03-20' };
  assert.deepEqual(applyPriorityAssignment([covered], priority), [
    { ...covered, startDate: '2027-04-01', endDate: '2027-04-11' },
    priority,
  ]);
});

test('resumes unfinished work when the original end falls inside the priority interval', () => {
  const interrupted = { ...assignment, startDate: '2027-02-01', endDate: '2027-03-15' };
  assert.deepEqual(applyPriorityAssignment([interrupted], priority, undefined, () => 'continued'), [
    { ...interrupted, endDate: '2027-02-28' },
    { ...interrupted, id: 'continued', startDate: '2027-04-01', endDate: '2027-04-15' },
    priority,
  ]);
});

test('does not interrupt another employee or the same project', () => {
  const otherEmployee = { ...assignment, id: 'other', employeeId: 'maria' };
  const sameProject = { ...assignment, id: 'same', projectId: 'fast' };
  assert.deepEqual(applyPriorityAssignment([otherEmployee, sameProject], priority), [otherEmployee, sameProject, priority]);
});
