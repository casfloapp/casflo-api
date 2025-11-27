import { z } from 'zod';

export const registerSchema = z.object({
  full_name: z.string().min(1, 'Full name required'),
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
