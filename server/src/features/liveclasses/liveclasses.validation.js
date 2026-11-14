const { z } = require('zod');

const create = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().max(1000).optional(),
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now() - 60 * 1000, 'scheduledAt must be in the future'),
  durationMin: z.number().int().min(5).max(480).default(60),
});

module.exports = { create };
