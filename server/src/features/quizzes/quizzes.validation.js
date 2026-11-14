const { z } = require('zod');

const question = z
  .object({
    text: z.string().trim().min(3).max(500),
    type: z.enum(['single', 'multi', 'truefalse']).default('single'),
    options: z.array(z.object({ text: z.string().trim().min(1).max(300), isCorrect: z.boolean().default(false) })).min(2).max(8),
    points: z.number().int().min(1).max(20).default(1),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (q.type === 'truefalse' && q.options.length !== 2) ctx.addIssue({ code: 'custom', message: 'True/false needs exactly 2 options' });
    if (q.type !== 'multi' && correct !== 1) ctx.addIssue({ code: 'custom', message: 'Single-answer questions need exactly one correct option' });
    if (q.type === 'multi' && correct < 1) ctx.addIssue({ code: 'custom', message: 'Multi-answer questions need at least one correct option' });
  });

const create = z.object({
  title: z.string().trim().min(2).max(140),
  lesson: z.string().optional(),
  passingPercent: z.number().min(1).max(100).default(60),
  questions: z.array(question).min(1).max(50),
});

const attempt = z.object({
  answers: z.array(z.object({ question: z.string(), selected: z.array(z.number().int().min(0)).max(8) })).min(1),
});

module.exports = { create, update: create.partial(), attempt };
