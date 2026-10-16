import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const authorization = req.get('Authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) throw new ApiError(401, 'Bearer token required', 'AUTH_REQUIRED');
  let decoded;
  try {
    decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new ApiError(401, 'Invalid or expired token', 'INVALID_TOKEN');
  }
  const userId = Number(decoded.sub);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new ApiError(401, 'Invalid token', 'INVALID_TOKEN');
  }
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError(401, 'Account no longer exists', 'INVALID_TOKEN');
  req.user = user;
  next();
});
