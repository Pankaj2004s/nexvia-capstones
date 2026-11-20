const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const FONTS = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];
const findFont = () => FONTS.find((f) => fs.existsSync(f));

// Builds a small title-card video with a tone, so the demo lesson shows the course name instead of a test pattern.
// Falls back to ffmpeg's test pattern when no font is installed (drawtext needs one).
function makeDemoVideo(file, { title = 'LearnSphere', subtitle = 'Welcome and course roadmap', seconds = 12, size = '1280x720' } = {}) {
  const font = findFont();
  const audio = ['-f', 'lavfi', '-i', `sine=frequency=330:duration=${seconds}`];
  const encode = ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file];
  if (!font) {
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `testsrc2=duration=${seconds}:size=${size}:rate=24`, ...audio, ...encode], { stdio: 'ignore' });
    return file;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-card-'));
  const titleFile = path.join(dir, 'title.txt');
  const subFile = path.join(dir, 'sub.txt');
  fs.writeFileSync(titleFile, title);
  fs.writeFileSync(subFile, subtitle);
  const vf = [
    `drawtext=fontfile=${font}:textfile=${titleFile}:fontcolor=white:fontsize=56:x=(w-text_w)/2:y=(h/2)-70`,
    `drawtext=fontfile=${font}:textfile=${subFile}:fontcolor=0x93c5fd:fontsize=34:x=(w-text_w)/2:y=(h/2)+20`,
    `drawtext=fontfile=${font}:text='LearnSphere demo lesson':fontcolor=0x64748b:fontsize=24:x=(w-text_w)/2:y=h-70`,
  ].join(',');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=0x0f172a:s=${size}:d=${seconds}:r=24`, ...audio, '-vf', vf, ...encode], { stdio: 'ignore' });
  fs.rmSync(dir, { recursive: true, force: true });
  return file;
}

module.exports = { makeDemoVideo };
