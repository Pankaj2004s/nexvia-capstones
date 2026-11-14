const jwt = require('jsonwebtoken');
const cfg = require('../../config/env');

const cloudfrontEnabled = () => Boolean(cfg.cloudfront.domain && cfg.cloudfront.keyPairId && cfg.cloudfront.privateKey);

// CloudFront signed cookies grant access to every HLS segment under a path with one signature.
function cloudfrontSession(prefix, ttlSeconds, signer) {
  const { getSignedCookies } = signer || require('@aws-sdk/cloudfront-signer');
  const url = `https://${cfg.cloudfront.domain}/${prefix}/*`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  // A wildcard resource requires a CUSTOM policy (canned policies cannot contain '*').
  const policy = JSON.stringify({
    Statement: [{ Resource: url, Condition: { DateLessThan: { 'AWS:EpochTime': Math.floor(expiresAt.getTime() / 1000) } } }],
  });
  const cookies = getSignedCookies({ keyPairId: cfg.cloudfront.keyPairId, privateKey: cfg.cloudfront.privateKey, policy });
  const expires = expiresAt.toISOString();
  return {
    mode: 'cloudfront',
    playlistUrl: `https://${cfg.cloudfront.domain}/${prefix}/master.m3u8`,
    cookies,
    expiresAt: expires,
  };
}

// Fallback when CloudFront is not configured: short-lived JWT scoped to one video folder.
function localSession(prefix, ttlSeconds) {
  const token = jwt.sign({ prefix }, cfg.mediaSecret, { expiresIn: ttlSeconds });
  return {
    mode: 'local-signed',
    playlistUrl: `${cfg.publicApiUrl}/api/media/${prefix}/master.m3u8?token=${token}`,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
}

function createPlaybackSession(prefix, ttlSeconds = 2 * 3600, signer) {
  return cloudfrontEnabled() ? cloudfrontSession(prefix, ttlSeconds, signer) : localSession(prefix, ttlSeconds);
}

function verifyMediaToken(token, key) {
  const payload = jwt.verify(token, cfg.mediaSecret);
  return key === payload.prefix || key.startsWith(`${payload.prefix}/`);
}

module.exports = { createPlaybackSession, verifyMediaToken, cloudfrontEnabled, cloudfrontSession };
