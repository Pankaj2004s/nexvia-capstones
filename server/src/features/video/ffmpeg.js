const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RENDITION_DEFS = [
  { name: '360p', height: 360, videoKbps: 800, audioKbps: 96, bandwidth: 1000000 },
  { name: '720p', height: 720, videoKbps: 2500, audioKbps: 128, bandwidth: 2800000 },
];

function run(cmd, args, { onStdout } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; if (onStdout) onStdout(d.toString()); });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => reject(new Error(`Failed to start ${cmd}: ${e.message}`)));
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited with ${code}: ${err.slice(-500)}`))));
  });
}

async function probe(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file]);
  const info = JSON.parse(out);
  const video = (info.streams || []).find((s) => s.codec_type === 'video');
  if (!video) throw new Error('No video stream found in file');
  return {
    width: video.width, height: video.height,
    hasAudio: (info.streams || []).some((s) => s.codec_type === 'audio'),
    durationSec: Number(info.format && info.format.duration) || 0,
  };
}

function chooseRenditions(srcHeight) {
  const eligible = RENDITION_DEFS.filter((d) => d.height <= srcHeight);
  return eligible.length ? eligible : [{ name: `${srcHeight}p`, height: srcHeight, videoKbps: 600, audioKbps: 96, bandwidth: 800000 }];
}

async function transcodeRendition({ input, outDir, rendition, durationSec, hasAudio, onProgress }) {
  const dir = path.join(outDir, rendition.name);
  await fs.promises.mkdir(dir, { recursive: true });
  const args = [
    '-y', '-i', input,
    '-vf', `scale=-2:${rendition.height}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-b:v', `${rendition.videoKbps}k`, '-maxrate', `${Math.round(rendition.videoKbps * 1.2)}k`, '-bufsize', `${rendition.videoKbps * 2}k`,
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', `${rendition.audioKbps}k`, '-ac', '2'] : ['-an']),
    '-hls_time', '6', '-hls_playlist_type', 'vod',
    '-hls_segment_filename', path.join(dir, 'seg_%03d.ts'),
    '-progress', 'pipe:1', '-nostats', path.join(dir, 'index.m3u8'),
  ];
  await run('ffmpeg', args, {
    onStdout: (chunk) => {
      const m = chunk.match(/out_time_ms=(\d+)/g);
      if (m && durationSec > 0 && onProgress) {
        const last = Number(m[m.length - 1].split('=')[1]) / 1e6; // out_time_ms is in microseconds
        onProgress(Math.min(1, last / durationSec));
      }
    },
  });
}

async function makeThumbnail(input, outFile, durationSec) {
  const at = Math.min(1, durationSec / 2).toFixed(2);
  await run('ffmpeg', ['-y', '-ss', at, '-i', input, '-frames:v', '1', '-vf', 'scale=640:-2', outFile]);
}

function masterPlaylist(renditions, srcW, srcH) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const r of renditions) {
    const w = Math.round(((srcW * r.height) / srcH) / 2) * 2;
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${w}x${r.height},NAME="${r.name}"`, `${r.name}/index.m3u8`);
  }
  return `${lines.join('\n')}\n`;
}

module.exports = { probe, chooseRenditions, transcodeRendition, makeThumbnail, masterPlaylist, RENDITION_DEFS };
