const { z } = require('zod');

const create = z.object({
  title: z.string().trim().min(2).max(140),
  section: z.string().trim().min(1).max(100).default('General'),
  order: z.number().int().min(0).optional(),
  type: z.enum(['video', 'text']).default('video'),
  content: z.string().max(20000).optional(),
  isPreview: z.boolean().default(false),
});

module.exports = { create, update: create.partial() };
