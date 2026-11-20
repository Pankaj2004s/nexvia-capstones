const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

const { clientUrl, isTest } = require('./config/env');
const { notFound, errorHandler } = require('./shared/middleware/errorHandler');
const openapi = require('./docs/openapi');

const health = require('./features/health');
const auth = require('./features/auth');
const users = require('./features/users');
const courses = require('./features/courses');
const lessons = require('./features/lessons');
const enrollments = require('./features/enrollments');
const video = require('./features/video');
const quizzes = require('./features/quizzes');
const progress = require('./features/progress');
const liveclasses = require('./features/liveclasses');
const certificates = require('./features/certificates');
const payments = require('./features/payments');
const earnings = require('./features/earnings');
const admin = require('./features/admin');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: clientUrl.split(','), credentials: true }));
if (!isTest) app.use(morgan('dev'));
app.use(cookieParser());
// Razorpay signs the raw body, so the webhook must skip JSON parsing.
app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/api/health', health.routes);
app.use('/api/auth', auth.routes);
app.use('/api/users', users.routes);
app.use('/api/courses', courses.routes);
app.use('/api/admin', admin.routes);
// feature routers that define their own full paths under /api
[lessons, enrollments, video, quizzes, progress, liveclasses, certificates, payments, earnings].forEach((f) => app.use('/api', f.routes));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
