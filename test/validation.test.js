const test = require('node:test');
const assert = require('node:assert/strict');
const Task = require('../models/Task');
const { validateBody, validateId } = require('../controllers/taskController');

test('accepts a complete task and trims its title', () => {
  const values = validateBody({ title: '  Read chapter  ', category: 'College', priority: 'High', status: 'Pending', dueDate: '2026-10-28' }, { requireComplete: true });
  assert.equal(values.title, 'Read chapter');
  assert.equal(values.dueDate, '2026-10-28');
});

test('rejects missing, blank, and overlong task titles', () => {
  assert.throws(() => validateBody({ category: 'Work', priority: 'Low', status: 'Pending' }, { requireComplete: true }), /title is required/);
  assert.throws(() => validateBody({ title: '  ', category: 'Work', priority: 'Low', status: 'Pending' }), /cannot be blank/);
  assert.throws(() => validateBody({ title: 'x'.repeat(81) }), /80 characters/);
});

test('rejects invalid enums, description lengths, and impossible dates', () => {
  assert.throws(() => validateBody({ title: 'Task', category: 'Unknown' }), /category must be one of/);
  assert.throws(() => validateBody({ description: 'x'.repeat(501) }), /500 characters/);
  assert.throws(() => validateBody({ dueDate: '2026-02-30' }), /real calendar date/);
  assert.throws(() => validateBody({ dueDate: '28-10-2026' }), /real calendar date/);
});

test('status endpoint accepts only status and valid values', () => {
  assert.deepEqual(validateBody({ status: 'Completed' }, { statusOnly: true }), { status: 'Completed' });
  assert.throws(() => validateBody({ status: 'Done' }, { statusOnly: true }), /status must be/);
  assert.throws(() => validateBody({ status: 'Pending', title: 'Protected data' }, { statusOnly: true }), /Unexpected or protected/);
});

test('rejects protected fields on normal create/update requests', () => {
  assert.throws(() => validateBody({ title: 'Task', _id: 'attacker-value' }), /Unexpected or protected/);
  assert.throws(() => validateBody({ updatedAt: '2000-01-01' }), /Unexpected or protected/);
});

test('validates MongoDB task IDs', () => {
  assert.equal(validateId('671f00000000000000000001'), undefined);
  assert.throws(() => validateId('not-an-object-id'), /valid MongoDB ObjectId/);
});

test('Mongoose schema validates enums, title, and real date-only values without a database', () => {
  const valid = new Task({ title: 'A task', category: 'Personal', priority: 'Medium', status: 'Pending', dueDate: '2026-10-27' });
  assert.equal(valid.validateSync(), undefined);
  const invalid = new Task({ title: 'x'.repeat(81), category: 'Invalid', priority: 'Urgent', status: 'Pending', dueDate: '2026-02-30' });
  const error = invalid.validateSync();
  assert.ok(error);
  assert.ok(error.errors.title);
  assert.ok(error.errors.category);
  assert.ok(error.errors.priority);
  assert.ok(error.errors.dueDate);
});
