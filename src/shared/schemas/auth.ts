import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const bootstrapSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(10, 'Admin password must be at least 10 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const inviteSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  role: z.enum(['admin', 'user']).default('user'),
});

export const acceptInviteSchema = z.object({
  code: z.string().min(8, 'Invalid invite code'),
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type BootstrapInput = z.infer<typeof bootstrapSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
