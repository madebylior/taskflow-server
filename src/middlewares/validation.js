import { ApiError } from '../utils/ApiError.js';

const bad = (message) => { throw new ApiError(400, message, 'VALIDATION_ERROR'); };
const objectBody = (body) => body !== null && typeof body === 'object' && !Array.isArray(body);
const exactKeys = (value, allowed) => {
  if (!objectBody(value)) bad('JSON object body required');
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) bad(`Unknown field(s): ${extras.join(', ')}`);
};
const stringField = (value, field, min, max) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    bad(`${field} must be a string containing ${min}–${max} characters`);
  }
  return value.trim();
};
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};
export const positiveId = (value, name = 'id') => {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    bad(`${name} must be a positive integer`);
  }
  return Number(value);
};
export const validateId = (req, res, next) => {
  try { req.resourceId = positiveId(req.params.id); next(); } catch (error) { next(error); }
};

export function validateRegister(req, res, next) {
  try {
    exactKeys(req.body, ['name', 'email', 'password']);
    req.body.name = stringField(req.body.name, 'name', 2, 80);
    const email = stringField(req.body.email, 'email', 5, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('A valid email is required');
    req.body.email = email;
    if (typeof req.body.password !== 'string' || req.body.password.length < 8 || Buffer.byteLength(req.body.password, 'utf8') > 72) {
      bad('password must be at least 8 characters and at most 72 UTF-8 bytes');
    }
    next();
  } catch (error) { next(error); }
}
export function validateLogin(req, res, next) {
  try {
    exactKeys(req.body, ['email', 'password']);
    req.body.email = stringField(req.body.email, 'email', 5, 254).toLowerCase();
    if (typeof req.body.password !== 'string' || !req.body.password) bad('password is required');
    next();
  } catch (error) { next(error); }
}
const taskFields = ['title', 'description', 'completed', 'priority', 'dueDate', 'categoryId'];
export function validateTask(req, res, next) {
  try {
    const isCreate = req.method === 'POST';
    exactKeys(req.body, taskFields);
    if (isCreate && req.body.title === undefined) bad('title is required');
    if (!isCreate && Object.keys(req.body).length === 0) bad('At least one field is required');
    if (req.body.title !== undefined) req.body.title = stringField(req.body.title, 'title', 2, 120);
    if (req.body.description !== undefined && req.body.description !== null) {
      if (typeof req.body.description !== 'string' || req.body.description.length > 1000) bad('description must be a string up to 1000 characters or null');
      req.body.description = req.body.description.trim();
    }
    if (req.body.completed !== undefined && typeof req.body.completed !== 'boolean') bad('completed must be true or false');
    if (req.body.priority !== undefined && !['low', 'medium', 'high'].includes(req.body.priority)) bad('priority must be low, medium, or high');
    if (req.body.dueDate !== undefined && req.body.dueDate !== null && !validDate(req.body.dueDate)) bad('dueDate must be a real date in YYYY-MM-DD format or null');
    if (req.body.categoryId !== undefined && req.body.categoryId !== null) {
      if (typeof req.body.categoryId !== 'number' && typeof req.body.categoryId !== 'string') {
        bad('categoryId must be a positive integer or null');
      }
      req.body.categoryId = positiveId(String(req.body.categoryId), 'categoryId');
    }
    next();
  } catch (error) { next(error); }
}
export function validateCategory(req, res, next) {
  try {
    exactKeys(req.body, ['name']);
    req.body.name = stringField(req.body.name, 'name', 2, 60);
    next();
  } catch (error) { next(error); }
}
export function validateTaskQuery(req, res, next) {
  try {
    const allowed = ['search', 'completed', 'priority', 'categoryId', 'sort', 'order', 'page', 'limit'];
    const extras = Object.keys(req.query).filter((key) => !allowed.includes(key));
    if (extras.length) bad(`Unknown query parameter(s): ${extras.join(', ')}`);
    const q = req.query;
    if (q.search !== undefined && (typeof q.search !== 'string' || q.search.length > 100)) bad('search must be at most 100 characters');
    if (q.completed !== undefined && !['true', 'false'].includes(q.completed)) bad('completed must be true or false');
    if (q.priority !== undefined && !['low', 'medium', 'high'].includes(q.priority)) bad('Invalid priority');
    if (q.categoryId !== undefined) positiveId(q.categoryId, 'categoryId');
    if (q.sort !== undefined && !['createdAt', 'dueDate', 'title', 'priority'].includes(q.sort)) bad('Invalid sort field');
    if (q.order !== undefined && !['asc', 'desc'].includes(q.order)) bad('order must be asc or desc');
    for (const field of ['page', 'limit']) {
      if (q[field] !== undefined) positiveId(q[field], field);
    }
    if (q.page && Number(q.page) > 10000) bad('page must be at most 10000');
    if (q.limit && Number(q.limit) > 100) bad('limit must be at most 100');
    next();
  } catch (error) { next(error); }
}
