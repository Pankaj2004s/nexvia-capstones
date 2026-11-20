/* Seeds demo users, a course catalog, quizzes and (optionally) one real processed video.
   Usage: npm run seed             -> users + catalog + quizzes
          npm run seed -- --video  -> also builds a short demo video and runs the FFmpeg/HLS pipeline on it */
process.env.RUN_WORKER_INLINE = 'false';
const { connectDb, disconnectDb } = require('../src/config/db');
const { seedDatabase } = require('../src/seed');
const { PASSWORD } = require('../src/seed/catalog');

async function main() {
  await connectDb();
  const withVideo = process.argv.includes('--video');
  const { courses } = await seedDatabase({ withVideo, videoOptions: { seconds: 20 } });
  if (withVideo) console.log('Demo video processed and attached to the first lesson of the first course');
  console.log(`Seeded ${courses} courses. Logins (password ${PASSWORD}):`);
  console.log(' admin@learnsphere.dev | instructor@learnsphere.dev | instructor2@learnsphere.dev | student@learnsphere.dev | student2@learnsphere.dev');
  await disconnectDb();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
