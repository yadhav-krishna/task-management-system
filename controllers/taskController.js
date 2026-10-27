const mongoose = require('mongoose');
const Task = require('../models/Task');

const writableFields = ['title', 'description', 'category', 'priority', 'dueDate', 'status'];
const allowedCategories = ['Personal', 'College', 'Projects', 'Work', 'Other'];
const allowedPriorities = ['Low', 'Medium', 'High'];
const allowedStatuses = ['Pending', 'In Progress', 'Completed'];

function validateBody(body, { requireComplete = false, statusOnly = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Request body must be a JSON object.'); error.status = 400; throw error;
  }
  const allowed = statusOnly ? ['status'] : writableFields;
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    const error = new Error(`Unexpected or protected field: ${unknown.join(', ')}.`); error.status = 400; throw error;
  }
  if (statusOnly) {
    if (!allowedStatuses.includes(body.status)) {
      const error = new Error('status must be Pending, In Progress, or Completed.'); error.status = 400; throw error;
    }
    return { status: body.status };
  }
  if (requireComplete) {
    for (const field of ['title', 'category', 'priority', 'status']) {
      if (!(field in body)) { const error = new Error(`${field} is required.`); error.status = 400; throw error; }
    }
  }

  const values = {};
  for (const field of writableFields) if (field in body) values[field] = body[field];
  if ('title' in values) {
    if (typeof values.title !== 'string' || !values.title.trim()) {
      const error = new Error('title is required and cannot be blank.'); error.status = 400; throw error;
    }
    values.title = values.title.trim();
    if (values.title.length > 80) { const error = new Error('title must be 80 characters or fewer.'); error.status = 400; throw error; }
  }
  if ('description' in values && (typeof values.description !== 'string' || values.description.length > 500)) {
    const error = new Error('description must be text with at most 500 characters.'); error.status = 400; throw error;
  }
  if ('category' in values && !allowedCategories.includes(values.category)) {
    const error = new Error(`category must be one of: ${allowedCategories.join(', ')}.`); error.status = 400; throw error;
  }
  if ('priority' in values && !allowedPriorities.includes(values.priority)) {
    const error = new Error(`priority must be Low, Medium, or High.`); error.status = 400; throw error;
  }
  if ('status' in values && !allowedStatuses.includes(values.status)) {
    const error = new Error(`status must be Pending, In Progress, or Completed.`); error.status = 400; throw error;
  }
  if ('dueDate' in values) {
    if (values.dueDate === null) values.dueDate = '';
    if (typeof values.dueDate !== 'string') { const error = new Error('dueDate must be a date string or an empty string.'); error.status = 400; throw error; }
    if (values.dueDate && !isRealDate(values.dueDate)) { const error = new Error('dueDate must be a real calendar date in YYYY-MM-DD format.'); error.status = 400; throw error; }
  }
  return values;
}
function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function validateId(id) {
  if (!/^[a-f\d]{24}$/i.test(id) || !mongoose.isValidObjectId(id)) {
    const error = new Error('Task ID must be a valid MongoDB ObjectId.'); error.status = 400; throw error;
  }
}

async function getTasks(req, res) {
  const tasks = await Task.find().sort({ createdAt: -1, _id: 1 }).lean();
  res.json({ success: true, data: tasks });
}
async function getTask(req, res) {
  validateId(req.params.id);
  const task = await Task.findById(req.params.id).lean();
  if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found.' } });
  res.json({ success: true, data: task });
}
async function createTask(req, res) {
  const values = validateBody(req.body, { requireComplete: true });
  const task = await Task.create(values);
  res.status(201).json({ success: true, data: task });
}
async function updateTask(req, res) {
  validateId(req.params.id);
  const values = validateBody(req.body, { requireComplete: true });
  const task = await Task.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true, context: 'query' });
  if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found.' } });
  res.json({ success: true, data: task });
}
async function updateStatus(req, res) {
  validateId(req.params.id);
  const { status } = validateBody(req.body, { statusOnly: true });
  const task = await Task.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true, runValidators: true });
  if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found.' } });
  res.json({ success: true, data: task });
}
async function deleteTask(req, res) {
  validateId(req.params.id);
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found.' } });
  res.json({ success: true, data: { id: task._id, message: 'Task deleted.' } });
}

function dateOffset(offset) {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
async function seedDemoTasks(req, res) {
  const examples = [
    { demoKey: 'review-notes', title: 'Review lecture notes', description: 'Go over the week six notes and mark key concepts.', category: 'College', priority: 'High', dueDate: dateOffset(-1), status: 'Pending' },
    { demoKey: 'plan-weekend', title: 'Plan the weekend', description: 'Make room for a little rest and a catch-up with friends.', category: 'Personal', priority: 'Low', dueDate: dateOffset(2), status: 'Pending' },
    { demoKey: 'dashboard-wireframe', title: 'Build dashboard wireframe', description: 'Sketch the main views before implementation.', category: 'Projects', priority: 'High', dueDate: dateOffset(4), status: 'In Progress' },
    { demoKey: 'meeting-follow-up', title: 'Send meeting follow-up', description: 'Share the notes and action items with the team.', category: 'Work', priority: 'Medium', dueDate: dateOffset(0), status: 'Completed' },
    { demoKey: 'tidy-project-files', title: 'Tidy up project files', description: 'Archive old drafts and organize the shared folder.', category: 'Projects', priority: 'Medium', dueDate: dateOffset(1), status: 'In Progress' }
  ];
  const operations = examples.map((example) => ({
    updateOne: { filter: { demoKey: example.demoKey }, update: { $set: { ...example, isDemo: true } }, upsert: true }
  }));
  const result = await Task.bulkWrite(operations, { ordered: true });
  const tasks = await Task.find({ demoKey: { $in: examples.map((item) => item.demoKey) } }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { seeded: result.upsertedCount, refreshed: result.modifiedCount, tasks } });
}

module.exports = { getTasks, getTask, createTask, updateTask, updateStatus, deleteTask, seedDemoTasks, validateBody, validateId };
