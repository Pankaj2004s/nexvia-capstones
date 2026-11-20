const AppError = require('../utils/AppError');

// validate({ body: zodSchema, query: zodSchema, params: zodSchema })
module.exports = (schemas) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((i) => `${i.path.join('.') || part}: ${i.message}`);
      return next(new AppError('Validation failed', 400, details));
    }
    if (part === 'query') {
      Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
    } else {
      req[part] = result.data;
    }
  }
  next();
};
