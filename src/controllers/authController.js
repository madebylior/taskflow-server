import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicUser } from '../utils/serialize.js';

const signToken = (user) => jwt.sign({}, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: '2h', algorithm: 'HS256' });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.findOne({ where: { email } })) throw new ApiError(409, 'Email is already registered', 'EMAIL_EXISTS');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });
  res.status(201).json({ success: true, data: { user: publicUser(user), token: signToken(user) } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  res.json({ success: true, data: { user: publicUser(user), token: signToken(user) } });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});
