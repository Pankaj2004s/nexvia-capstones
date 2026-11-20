const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// generate a throwaway RSA key so the real CloudFront signer can run
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
process.env.CLOUDFRONT_DOMAIN = 'd111111abcdef8.cloudfront.net';
process.env.CLOUDFRONT_KEY_PAIR_ID = 'K2JCJMDEHXQW5F';
process.env.CLOUDFRONT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');

const LocalStorageAdapter = require('../src/shared/storage/local.adapter');
const S3StorageAdapter = require('../src/shared/storage/s3.adapter');
const delivery = require('../src/shared/storage/delivery');

describe('local storage adapter', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-local-'));
  const s = new LocalStorageAdapter(base);
  test('put/read/exists/remove', async () => {
    await s.putBuffer(Buffer.from('hello'), 'a/b/c.txt');
    expect(await s.exists('a/b/c.txt')).toBe(true);
    expect((await s.readBuffer('a/b/c.txt')).toString()).toBe('hello');
    await s.remove('a/b/c.txt');
    expect(await s.exists('a/b/c.txt')).toBe(false);
  });
  test('path traversal is blocked', () => {
    expect(() => s.resolve('../../etc/passwd')).toThrow(/Invalid storage key/);
    expect(() => s.resolve('a/../../x')).toThrow();
  });
  test('putDir keeps relative structure', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-src-'));
    fs.mkdirSync(path.join(src, '360p'));
    fs.writeFileSync(path.join(src, 'master.m3u8'), 'x');
    fs.writeFileSync(path.join(src, '360p', 'seg_000.ts'), 'y');
    const keys = await s.putDir(src, 'videos/v1');
    expect(keys.sort()).toEqual(['videos/v1/360p/seg_000.ts', 'videos/v1/master.m3u8']);
  });
});

describe('S3 adapter (fake AWS client)', () => {
  test('uploads with the right bucket, key and content type', async () => {
    const sent = [];
    const uploads = [];
    class FakeUpload { constructor(o) { uploads.push(o.params); } async done() {} }
    const s3 = new S3StorageAdapter({ bucket: 'my-bucket', region: 'ap-south-1', client: { send: async (cmd) => { sent.push(cmd); return {}; } }, Upload: FakeUpload });
    const f = path.join(os.tmpdir(), 'x.m3u8');
    fs.writeFileSync(f, '#EXTM3U');
    await s3.putFile(f, 'videos/1/master.m3u8');
    expect(uploads[0]).toMatchObject({ Bucket: 'my-bucket', Key: 'videos/1/master.m3u8', ContentType: 'application/vnd.apple.mpegurl' });
    await s3.putBuffer(Buffer.from('pdf'), 'certificates/a.pdf', 'application/pdf');
    expect(sent[0].input).toMatchObject({ Bucket: 'my-bucket', Key: 'certificates/a.pdf', ContentType: 'application/pdf' });
  });
});

describe('CloudFront signed delivery', () => {
  test('enabled when domain, key pair and private key are configured', () => expect(delivery.cloudfrontEnabled()).toBe(true));
  test('session returns a CloudFront playlist URL plus signed cookies scoped to the video folder', () => {
    const s = delivery.createPlaybackSession('videos/abc123', 3600);
    expect(s.mode).toBe('cloudfront');
    expect(s.playlistUrl).toBe('https://d111111abcdef8.cloudfront.net/videos/abc123/master.m3u8');
    expect(Object.keys(s.cookies).sort()).toEqual(['CloudFront-Key-Pair-Id', 'CloudFront-Policy', 'CloudFront-Signature']);
    const policy = JSON.parse(Buffer.from(s.cookies['CloudFront-Policy'].replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/'), 'base64').toString());
    expect(policy.Statement[0].Resource).toBe('https://d111111abcdef8.cloudfront.net/videos/abc123/*');
    expect(s.cookies['CloudFront-Key-Pair-Id']).toBe('K2JCJMDEHXQW5F');
  });
  test('media tokens are scoped to one video prefix', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ prefix: 'videos/abc' }, require('../src/config/env').mediaSecret, { expiresIn: 60 });
    expect(delivery.verifyMediaToken(token, 'videos/abc/master.m3u8')).toBe(true);
    expect(delivery.verifyMediaToken(token, 'videos/abcd/master.m3u8')).toBe(false); // prefix trick must fail
    expect(delivery.verifyMediaToken(token, 'videos/other/master.m3u8')).toBe(false);
    expect(() => delivery.verifyMediaToken('garbage', 'videos/abc/x')).toThrow();
  });
});
