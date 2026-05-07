import { z } from 'zod';

export const feedbackSchema = z.object({
  type: z.enum(['complaint', 'suggestion', 'compliment'], {
    required_error: 'Please select a feedback type',
  }),
  service: z.string().min(1, 'Please select a public service'),
  barangay: z.string().min(1, 'Please select a barangay'),
  location: z.string().min(6, 'Please provide a more specific location (at least 6 characters)'),
  content: z
    .string()
    .min(35, 'Please provide more details (at least 35 characters)')
    .min(12, 'Please provide more context (at least 12 words)', {
      message: 'Please provide more context (at least 12 words)',
    })
    .transform((val) => val.trim()),
  evidenceNote: z.string().optional(),
});

export const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50, 'Display name must be less than 50 characters'),
  handle: z
    .string()
    .min(3, 'Handle must be at least 3 characters')
    .max(20, 'Handle must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores'),
  bio: z.string().max(200, 'Bio must be less than 200 characters').optional(),
});

export const searchSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters'),
  filter: z.enum(['all', 'feedback', 'users', 'feedboxes']).optional(),
});

export const validateForm = (schema, data) => {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.reduce((acc, err) => {
        const path = err.path.join('.');
        acc[path] = err.message;
        return acc;
      }, {});
      return { success: false, data: null, errors };
    }
    return { success: false, data: null, errors: { general: 'Validation failed' } };
  }
};
