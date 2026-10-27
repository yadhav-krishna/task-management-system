require('dotenv').config();
const mongoose = require('mongoose');
const { seedDemoTasks } = require('../controllers/taskController');
const Task = require('../models/Task');

// The standalone seed command inserts or refreshes only records carrying fixed demo keys.
async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Create a .env file first.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await seedDemoTasks({}, response);
  console.log(`Demo tasks ready. Inserted: ${response.body.data.seeded}; refreshed: ${response.body.data.refreshed}.`);
  await mongoose.disconnect();
}
seed().catch(async (error) => { console.error(`Demo seeding failed: ${error.message}`); await mongoose.disconnect(); process.exitCode = 1; });
