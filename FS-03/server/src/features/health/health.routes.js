const router = require('express').Router();
const mongoose = require('mongoose');

router.get('/', (req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
  res.json({ status: dbState === 'connected' ? 'ok' : 'degraded', service: 'learnsphere-api', db: dbState, uptimeSec: Math.round(process.uptime()), time: new Date().toISOString() });
});

module.exports = router;
