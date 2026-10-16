import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { validateId, validateCategory } from '../middlewares/validation.js';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';

const router = Router();
router.use(requireAuth);
router.route('/').get(listCategories).post(validateCategory, createCategory);
router.route('/:id').patch(validateId, validateCategory, updateCategory).delete(validateId, deleteCategory);
export default router;
