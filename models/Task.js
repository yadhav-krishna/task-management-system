const mongoose = require('mongoose');

const categories = ['Personal', 'College', 'Projects', 'Work', 'Other'];
const priorities = ['Low', 'Medium', 'High'];
const statuses = ['Pending', 'In Progress', 'Completed'];

// dueDate is kept as YYYY-MM-DD text so a date-only deadline cannot shift time zones.
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 500 },
  category: { type: String, enum: categories, default: 'Personal', required: true },
  priority: { type: String, enum: priorities, default: 'Medium', required: true },
  dueDate: {
    type: String,
    default: '',
    validate: {
      validator(value) {
        if (value === '') return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
      },
      message: 'dueDate must be a real calendar date in YYYY-MM-DD format.'
    }
  },
  status: { type: String, enum: statuses, default: 'Pending', required: true },
  // Internal fields support safe, repeatable demo seeding without touching user tasks.
  isDemo: { type: Boolean, default: false, select: false },
  demoKey: { type: String, unique: true, sparse: true, select: false }
}, { timestamps: true, versionKey: false, strict: 'throw' });

module.exports = mongoose.model('Task', taskSchema);
