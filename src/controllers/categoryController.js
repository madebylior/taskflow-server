import { Category } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.findAll({ where: { userId: req.user.id }, order: [['name', 'ASC']] });
  res.json({ success: true, data: categories });
});
export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({ name: req.body.name, userId: req.user.id });
  res.status(201).json({ success: true, data: category });
});
const ownedCategory = async (req) => {
  const category = await Category.findOne({ where: { id: req.resourceId, userId: req.user.id } });
  if (!category) throw new ApiError(404, 'Category not found', 'NOT_FOUND');
  return category;
};
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await ownedCategory(req);
  category.name = req.body.name;
  await category.save();
  res.json({ success: true, data: category });
});
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await ownedCategory(req);
  // The SQL foreign key uses ON DELETE SET NULL, so tasks are kept atomically.
  await category.destroy();
  res.json({ success: true, message: 'Category deleted; related tasks were kept' });
});
