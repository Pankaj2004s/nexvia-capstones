const { z } = require('zod');

const register = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  role: z.enum(['student', 'instructor']).default('student'),
});

const login = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

module.exports = { register, login };
