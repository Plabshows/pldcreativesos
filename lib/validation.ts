import { z } from 'zod';

const nullableText = z.string().trim().max(10000).nullable().optional();
export const clientCreateSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  clientType: z.string().trim().min(1).max(80).default('Other'),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).default('España'),
  leadSource: z.string().trim().max(120).optional(),
  notes: nullableText,
  nextFollowUp: z.string().date().optional(),
});

export const eventCreateSchema = z.object({
  eventName: z.string().trim().min(1).max(200),
  clientId: z.string().uuid().optional(),
  eventDate: z.string().date().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  venue: z.string().trim().max(240).optional(), city: z.string().trim().max(120).optional(),
  eventType: z.string().trim().max(80).optional(), brief: nullableText,
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200), description: nullableText,
  eventId: z.string().uuid().optional(), clientId: z.string().uuid().optional(),
  deadline: z.string().datetime().optional(), priority: z.enum(['low','medium','high','urgent']).default('medium'),
});

export function errorMessage(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'campo'}: ${issue.message}`).join('; ');
}
