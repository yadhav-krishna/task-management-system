require('dotenv').config();
const path = require('path');
const express = require('express');
const connectToDatabase = require('./config/db');
const taskRoutes = require('./routes/taskRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const port = Number(process.env.PORT) || 3000;
const projectDirectory = __dirname;

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use('/api/tasks', taskRoutes);
app.use('/api', notFound);
app.use(express.static(projectDirectory, { extensions: ['html'] }));
app.use((req, res, next) => {
  if (req.method === 'GET') return res.sendFile(path.join(projectDirectory, 'index.html'));
  next();
});
app.use(errorHandler);

// Wait for MongoDB before opening the HTTP port so API requests never pretend to save offline.
connectToDatabase(process.env.MONGODB_URI)
  // Bind only to loopback because this prototype has no authentication or access control.
  .then(() => app.listen(port, '127.0.0.1', () => console.log(`Taskflow server listening at http://localhost:${port}`)))
  .catch((error) => {
    console.error(`Could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
  });

module.exports = app;
