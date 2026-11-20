const { isTest } = require('../../config/env');

const log = (level) => (...a) => {
  if (!isTest) console[level === 'error' ? 'error' : 'log'](`[${level}]`, ...a);
};
module.exports = { info: log('info'), warn: log('warn'), error: log('error') };
