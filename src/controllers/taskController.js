import { Op } from 'sequelize';
import { Task, Category } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function checkCategory(categoryId, userId) {
  if (categoryId === undefined || categoryId === null) return;
  const category = await Category.findOne({ where: { id: categoryId, userId } });
  if (!category) throw new ApiError(404, 'Category not found', 'NOT_FOUND');
}
const taskInclude = [{ model: Category, as: 'category', attributes: ['id', 'name'] }];

export const listTasks = asyncHandler(async (req, res) => {
  const { search, completed, priority, categoryId, sort = 'createdAt', order = 'desc' } = req.query;
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const where = { userId: req.user.id };
  if (completed !== undefined) where.completed = completed === 'true';
  if (priority !== undefined) where.priority = priority;
  if (categoryId !== undefined) where.categoryId = Number(categoryId);
  if (search !== undefined && search.trim()) where.title = { [Op.like]: `%${search.trim()}%` };
  const { rows, count } = await Task.findAndCountAll({
    where, include: taskInclude, distinct: true,
    order: [[sort, order.toUpperCase()], ['id', 'ASC']],
    limit, offset: (page - 1) * limit,
  });
  res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
});

export const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ where: { id: req.resourceId, userId: req.user.id }, include: taskInclude });
  if (!task) throw new ApiError(404, 'Task not found', 'NOT_FOUND');
  res.json({ success: true, data: task });
});

export const createTask = asyncHandler(async (req, res) => {
  await checkCategory(req.body.categoryId, req.user.id);
  const task = await Task.create({ ...req.body, userId: req.user.id });
  res.status(201).json({ success: true, data: task });
});

export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ where: { id: req.resourceId, userId: req.user.id } });
  if (!task) throw new ApiError(404, 'Task not found', 'NOT_FOUND');
  await checkCategory(req.body.categoryId, req.user.id);
  await task.update(req.body);
  res.json({ success: true, data: task });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ where: { id: req.resourceId, userId: req.user.id } });
  if (!task) throw new ApiError(404, 'Task not found', 'NOT_FOUND');
  await task.destroy();
  res.json({ success: true, message: 'Task deleted' });
});
