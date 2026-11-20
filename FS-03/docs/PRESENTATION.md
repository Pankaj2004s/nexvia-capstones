# LearnSphere: 10-Minute Presentation Outline

Live demo: __WEB_URL__
API: __API_URL__/api/health

This outline is for a 10-minute talk about LearnSphere alone. If the final presentation covers two projects in 10 minutes, give LearnSphere about 5 minutes: slides 1 to 3, one engineering decision (slide 4), a short demo and the honest limits.

## Before the presentation

- Open the API health URL 5 minutes before starting. The free Render plan sleeps and the first request can take about a minute.
- Log in once as `student@learnsphere.dev` and once as `instructor@learnsphere.dev` (password `Demo@1234`) in two browser windows.
- Play the preview lesson of "Complete Node.js & Express Bootcamp" once. After a restart the demo video is rebuilt in the background and can take a minute or two to appear.
- Keep these open: `docs/ARCHITECTURE.md` on GitHub, `docs/TEST_RESULTS.md` on GitHub and the `docs/screenshots` folder.
- If the live demo fails, show the screenshots and the architecture diagram.

## Timing

| Time | Slide | Content |
| --- | --- | --- |
| 0:00 to 1:00 | 1. What it is | A learning platform: video lessons, live classes, quizzes, certificates, instructor earnings. Stack in one line. Live URL. |
| 1:00 to 2:00 | 2. Requirements | The table below. |
| 2:00 to 3:30 | 3. Architecture | `docs/ARCHITECTURE.md`: feature-based monolith, Redis and a worker for video, storage adapters, Socket.IO only for WebRTC signaling. |
| 3:30 to 5:30 | 4. Three engineering decisions | Video off the request path, trusted payments, storage adapter. Details below. |
| 5:30 to 8:00 | 5. Live demo | Script below. |
| 8:00 to 9:00 | 6. Testing and deployment | 73 server tests, 10 client tests and 22 browser steps pass; 89% line coverage. Deployed on Vercel, Render and Atlas. |
| 9:00 to 10:00 | 7. Honest limits and next steps | Test-mode payments, no real AWS, free-tier sleep, STUN only. |

## Slide 2: requirements and where they are

| Requirement | In the project |
| --- | --- |
| Roles, course, lesson, enrollment | Mongoose models and role middleware (student, instructor, admin) |
| Video upload, FFmpeg in BullMQ | Upload, queue job, FFmpeg to HLS (360p and 720p), retries, status and progress |
| CloudFront delivery | S3 adapter and CloudFront signed URLs and cookies, covered by tests with a fake client; the live site uses local storage |
| Quizzes, auto-grading, progress | Server-side grading, answers never sent to students, progress per lesson |
| Live classes with WebRTC | Mesh of up to 7 people, Socket.IO signaling, chat |
| PDF certificates | pdfkit, one per student and course, public verify page |
| Payments and earnings | Razorpay test mode, signature check, webhook, 80/20 instructor split |
| Redux Toolkit | `client/src/app/slices.js` |

## Slide 4: three engineering decisions

1. **Video processing is a job, not part of the request.** The upload returns quickly. A BullMQ job runs FFmpeg, retries with backoff and marks the video `failed` only on the last attempt. The page shows progress.
2. **Payments cannot trust the browser.** The server creates the Razorpay order and checks the signature. The webhook is a backup, and verify plus webhook arriving for the same payment enrolls the student once and creates one earning.
3. **Storage behind an adapter.** The same code runs on local disk or S3 with CloudFront signed URLs. I have no AWS account, so S3 is tested with a fake client and the live site uses local disk. That has a cost: on the free host the disk is wiped on restart, so the demo video is rebuilt at start-up (`SEED_DEMO`).

## Live demo script

1. Catalog: search "react", filter free courses.
2. Open "Complete Node.js & Express Bootcamp" and play the free preview (adaptive HLS).
3. Enroll in a free course, finish lessons, take the quiz, download the certificate and open its public verify link.
4. Switch to the instructor window: open a course editor, upload a short video and watch the status go from queued to ready.
5. Paid course: start checkout in Razorpay test mode and pay with a test card.
6. Live class: instructor goes live, student joins, both see video, send a chat message, instructor ends the class.

## Honest limits

- Razorpay is test mode and there is no real payout.
- S3 and CloudFront were not run on real AWS.
- Videos uploaded on the live site disappear after a restart.
- Live classes use STUN only and chat lives in memory on a single instance.
- The tests ran on FerretDB, not on real MongoDB.

## Next steps

LiveKit or another SFU for large classes, the Socket.IO Redis adapter, direct-to-S3 multipart uploads from the browser, subtitles, refunds and live Razorpay mode.
