import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { validateId, validateTask, validateTaskQuery } from '../middlewares/validation.js';
import { listTasks, getTask, createTask, updateTask, deleteTask } from '../controllers/taskController.js';

const router = Router();
router.use(requireAuth);
router.route('/').get(validateTaskQuery, listTasks).post(validateTask, createTask);
router.route('/:id').get(validateId, getTask).patch(validateId, validateTask, updateTask).delete(validateId, deleteTask);
export default router;
