import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  themeMode: z.enum(['system', 'light', 'dark']).optional(),
  accentColor: z.enum(['emerald', 'indigo', 'violet', 'amber', 'rose', 'cyan']).optional(),
  fontSize: z.enum(['small', 'normal', 'large']).optional(),
  density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  borderRadius: z.enum(['none', 'small', 'medium', 'large']).optional(),
  reducedMotion: z.enum(['system', 'reduce', 'no-preference']).optional(),
  sidebarCollapsed: z.boolean().optional(),
  timezone: z.string().min(1).max(50).optional(),
  baseCurrency: z.string().length(3).optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
