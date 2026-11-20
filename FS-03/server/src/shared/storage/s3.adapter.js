const fs = require('fs');
const path = require('path');
const mime = { '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };

// Real S3 adapter. `client` and `Upload` can be injected so the logic is unit-testable without AWS.
class S3StorageAdapter {
  constructor({ bucket, region, client, Upload }) {
    this.name = 's3';
    this.bucket = bucket;
    const { S3Client } = require('@aws-sdk/client-s3');
    this.client = client || new S3Client({ region });
    this.Upload = Upload || require('@aws-sdk/lib-storage').Upload;
  }

  async putFile(localPath, key) {
    const ContentType = mime[path.extname(localPath).toLowerCase()] || 'application/octet-stream';
    const upload = new this.Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: fs.createReadStream(localPath), ContentType },
    });
    await upload.done();
    return key;
  }

  async putBuffer(buffer, key, contentType = 'application/octet-stream') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
    return key;
  }

  async putDir(localDir, prefix) {
    const keys = [];
    const walk = async (dir) => {
      for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(abs);
        else {
          const key = `${prefix}/${path.relative(localDir, abs).split(path.sep).join('/')}`;
          await this.putFile(abs, key);
          keys.push(key);
        }
      }
    };
    await walk(localDir);
    return keys;
  }

  async downloadToFile(key, destPath) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(destPath);
      out.Body.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
    });
    return destPath;
  }

  async exists(key) {
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    try { await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); return true; } catch (e) { return false; }
  }

  async readBuffer(key) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks = [];
    for await (const c of out.Body) chunks.push(c);
    return Buffer.concat(chunks);
  }

  async remove(key) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

module.exports = S3StorageAdapter;
