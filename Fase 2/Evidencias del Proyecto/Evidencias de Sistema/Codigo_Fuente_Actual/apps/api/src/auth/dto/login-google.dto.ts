import { z } from 'zod';

export const loginGoogleSchema = z.object({
  credential: z.string().min(50).max(8192),
});

export type LoginGoogleDto = z.infer<typeof loginGoogleSchema>;
