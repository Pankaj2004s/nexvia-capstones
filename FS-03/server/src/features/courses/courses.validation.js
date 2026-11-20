const { z } = require('zod');

const sections = z.array(z.object({ title: z.string().trim().min(1).max(100), order: z.number().int().optional() })).max(30);

const create = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(2).max(60),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  price: z.number().min(0).max(100000).default(0),
  thumbnail: z.string().url().optional(),
  tags: z.array(z.string().trim().max(30)).max(10).default([]),
  sections: sections.default([]),
});

const update = create.partial();

const list = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['newest', 'popular', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

module.exports = { create, update, list };
