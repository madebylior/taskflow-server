import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, me } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validateRegister, validateLogin } from '../middlewares/validation.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts; try later' } },
});
router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.get('/me', requireAuth, me);
export default router;
