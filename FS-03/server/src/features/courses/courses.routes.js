const router = require('express').Router();
const c = require('./courses.controller');
const v = require('./courses.validation');
const validate = require('../../shared/middleware/validate');
const { authenticate, optionalAuth, authorize } = require('../../shared/middleware/auth');

router.get('/', validate({ query: v.list }), c.list);
router.get('/mine', authenticate, authorize('instructor', 'admin'), c.mine);
router.post('/', authenticate, authorize('instructor', 'admin'), validate({ body: v.create }), c.create);
router.get('/:idOrSlug', optionalAuth, c.detail);
router.patch('/:id', authenticate, authorize('instructor', 'admin'), validate({ body: v.update }), c.update);
router.post('/:id/submit', authenticate, authorize('instructor', 'admin'), c.submit);
router.delete('/:id', authenticate, authorize('instructor', 'admin'), c.remove);

module.exports = router;
