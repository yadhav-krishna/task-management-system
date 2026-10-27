const express = require('express');
const controller = require('../controllers/taskController');

const router = express.Router();
// Express 4 does not automatically forward rejected async handlers to error middleware.
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/', asyncRoute(controller.getTasks));
router.post('/', asyncRoute(controller.createTask));
router.post('/demo/seed', asyncRoute(controller.seedDemoTasks));
router.get('/:id', asyncRoute(controller.getTask));
router.put('/:id', asyncRoute(controller.updateTask));
router.patch('/:id/status', asyncRoute(controller.updateStatus));
router.delete('/:id', asyncRoute(controller.deleteTask));

module.exports = router;
