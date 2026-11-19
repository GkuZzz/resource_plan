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
    { ...assignment, id: 'right', startDate: '2027-04-01' },
    priority,
  ]);
});

test('removes an assignment fully covered by a priority interval', () => {
  const covered = { ...assignment, startDate: '2027-03-10', endDate: '2027-03-20' };
  assert.deepEqual(applyPriorityAssignment([covered], priority), [priority]);
});

test('does not interrupt another employee or the same project', () => {
  const otherEmployee = { ...assignment, id: 'other', employeeId: 'maria' };
  const sameProject = { ...assignment, id: 'same', projectId: 'fast' };
  assert.deepEqual(applyPriorityAssignment([otherEmployee, sameProject], priority), [otherEmployee, sameProject, priority]);
});
