const mongoose = require('mongoose');

async function connectToDatabase(uri) {
  if (!uri) throw new Error('MONGODB_URI is missing. Add it to the .env file.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}

module.exports = connectToDatabase;
