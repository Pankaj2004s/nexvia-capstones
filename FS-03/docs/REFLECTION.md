# LearnSphere: Individual Reflection

Author: Pankaj Sharma
Project: FS-03 LearnSphere, a learning platform with video lessons and live classes
Live demo: https://nexvia-capstones.vercel.app

## 1. What this project is and how I worked on it

LearnSphere is a MERN learning platform. Students browse courses, watch adaptive video, join live classes over WebRTC, take quizzes and get a PDF certificate. Instructors upload videos and see earnings, and admins review courses. It also uses Redis with BullMQ, FFmpeg, Razorpay in test mode, and storage adapters for local disk and S3.

I want to be clear about how it was made. The code for this project was written with an AI assistant (Claude), so I am not claiming that I typed it myself the way I did with FS-01. My own part was getting it to run for real and making it mine to operate: I extracted it, installed and checked the tools, ran the whole stack with Docker Compose, logged in as the different roles and clicked through the flows. I found problems by using it, I decided what to change, I connected my own MongoDB Atlas database and Razorpay test account, deployed it to Render and Vercel, and pushed it to GitHub.

## 2. Problems I ran into and what I did

**The first run looked unfinished.** The course cards showed random landscape photos from a stock photo service and the demo lesson video was an FFmpeg test pattern. Neither had anything to do with the courses. I replaced the photos with one generated SVG thumbnail per course and made the demo video a title card with the course name.

**The database address was fixed in the compose file.** `docker-compose.yml` always used the local Mongo container, so I could not point it at Atlas. I changed it to read `MONGO_URI`, Redis, the secrets and the Razorpay keys from a `.env` file, with local defaults.

**The free host forgets files.** On Render's free plan there is no separate worker and the disk is wiped on every restart. The video worker now runs inside the API process, and with `SEED_DEMO=true` the server seeds an empty database once and rebuilds the demo video when its files are gone. A test covers the wipe and rebuild.

**Several services had to agree.** Vercel, Render, Atlas, a Redis-compatible store and Razorpay each needed matching URLs and secrets: CORS (`CLIENT_URL`), the API address baked into the client at build time (`VITE_API_URL`), signed video links (`PUBLIC_API_URL`), and the webhook secret. Secrets live only in the Render and Vercel dashboards and in my local `.env`, not in Git.

## 3. Decisions and trade-offs

**Feature-based monolith.** One deployable app is easier to run and deploy on free tiers. I gave up scaling features separately. Each feature has its own folder and talks to others through its service, so it can be split later.

**Video as a background job.** Conversion with FFmpeg is slow, so uploads return quickly and a BullMQ job does the work with retries. The cost is that Redis is another service to run.

**Storage adapters with local disk on the live site.** I do not have an AWS account. The S3 and CloudFront code is covered by tests with a fake client, and the live site uses local disk. That works for a demo but not for real use, because uploaded videos disappear when the free server restarts.

**Razorpay in test mode.** Enough to show orders, signature checks, the webhook and earnings without handling real money.

## 4. What I learned

By running and deploying the project I understand much better how the parts connect: the compose setup with Mongo, Redis, API, worker and client; environment-based configuration; what each of Atlas, Render and Vercel does and how their URLs must match; why video conversion is a background job; and why a payment is confirmed on the server and not in the browser.

## 5. What I am still weak at

I could not write most of this code from scratch on my own. WebRTC signaling, BullMQ internals and CloudFront signed cookies are the parts I understand least. `docs/LEARNING_NOTES.md` explains each module and is what I use to study them. My next step is to rebuild a small piece, such as the quiz grading or the payment verification, without looking at the code.

## 6. Honest limits

- Payments are Razorpay test mode only, with no real payout.
- S3 and CloudFront were not run on real AWS.
- Videos uploaded on the live site disappear after a restart of the free server.
- Live classes use STUN only and keep chat in memory on one instance.
- The automated tests ran on FerretDB, a MongoDB-compatible server, not on real MongoDB.
- The free Render service sleeps, so the first request can take about a minute.

## 7. If I had more time

1. Move video storage to S3 so uploads survive restarts, and measure CloudFront delivery.
2. Add a TURN server and run a live class across two different networks.
3. Add refunds and an idempotency key on order creation.
