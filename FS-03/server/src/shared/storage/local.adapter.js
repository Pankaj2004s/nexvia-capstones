const fs = require('fs');
const path = require('path');
const AppError = require('../utils/AppError');

class LocalStorageAdapter {
  constructor(baseDir) {
    this.name = 'local';
    this.baseDir = path.resolve(baseDir);
  }

  // Resolves a storage key to an absolute path and blocks path traversal (../).
  resolve(key) {
    const full = path.resolve(this.baseDir, key);
    if (!full.startsWith(this.baseDir + path.sep) && full !== this.baseDir) {
      throw new AppError('Invalid storage key', 400);
    }
    return full;
  }

  async putFile(localPath, key) {
    const dest = this.resolve(key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(localPath, dest);
    return key;
  }

  async putBuffer(buffer, key) {
    const dest = this.resolve(key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, buffer);
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
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(this.resolve(key), destPath);
    return destPath;
  }

  async exists(key) {
    try { await fs.promises.access(this.resolve(key)); return true; } catch (e) { return false; }
  }

  async readBuffer(key) {
    return fs.promises.readFile(this.resolve(key));
  }

  createReadStream(key) {
    return fs.createReadStream(this.resolve(key));
  }

  async remove(key) {
    await fs.promises.rm(this.resolve(key), { force: true, recursive: true });
  }
}

module.exports = LocalStorageAdapter;
