# Test results and performance

All numbers below were produced by running the commands in this repository (2026-11-14).

## Automated tests

| Suite | Tool | Result |
|---|---|---|
| API (auth, RBAC, courses, catalog, lessons, quizzes, progress, certificates, payments, earnings, storage, video pipeline, live classes) | Jest + Supertest | **68 / 68 passed** (7 suites) |
| Client (Redux slices, formatters) | Vitest | **10 / 10 passed** |
| Real-browser end to end (Chromium via Playwright) | `e2e/*.py` | **23 / 23 steps passed** (13 student flow + 10 instructor/admin/live) |

Backend coverage: **88.7% lines**, 84.3% statements, 79.2% functions, 65.0% branches.

What the tests prove (selection):
- Refresh-token rotation: the old token stops working. (A test caught that two refreshes in the same second produced identical tokens; fixed with a unique `jti`.)
- Quiz answers are never returned to students; multi-select needs the exact set; unanswered counts as wrong.
- Certificate is refused until all lessons are complete **and** all quizzes are passed; one certificate per student per course; PDF is valid; public verification works; other users cannot download it.
- Payments: forged signature rejected, someone else's order cannot be verified, valid signature enrolls once and creates an 80/20 earning, verify retried and webhook retried do not double count.
- Video: real upload -> BullMQ -> FFmpeg -> HLS (360p + 720p) -> signed playback; segments are real MPEG-TS; wrong/missing/foreign tokens and path traversal are refused; failed jobs retry and are marked `failed` only on the last attempt.
- Live classes: sockets need a valid JWT; cannot join before the class is live or without enrollment; signals only reach a peer in the same room; chat history for late joiners; room capacity (instructor + 6) enforced; ending the class notifies everyone.
- Browser E2E: catalog search/filter/pagination, register, free preview plays through signed HLS (Chromium decoded the 720p/360p stream), enroll, complete lessons, take a quiz, issue and download a real PDF certificate, verify it, role guards, instructor uploads a video and watches processing reach Ready, builds a quiz, admin approves, and **two real browsers join a live class with WebRTC and both receive the other's video**, chat both ways, end class.

## Performance (single Node process, 20 concurrent connections, 8 s each)

Measured with `autocannon` against the API on a shared 2-core sandbox, with MongoDB-compatible FerretDB on SQLite (see limits below), so **absolute numbers are conservative; real MongoDB will be faster**.

| Endpoint | Requests/s | p50 | p97.5 | p99 | Errors |
|---|---|---|---|---|---|
| `GET /api/health` | 3,537 | 3 ms | 19 ms | 28 ms | 0 |
| `GET /api/users/me` (auth + DB read) | 510 | 36 ms | 71 ms | 83 ms | 0 |
| `GET /api/courses?limit=8` (catalog) | 99 | 181 ms | 424 ms | 488 ms | 0 |
| `GET /api/courses?q=react` (search) | 118 | 140 ms | 440 ms | 495 ms | 0 |
| `GET /api/courses/:slug` (detail + outline) | 98 | 140 ms | 625 ms | 723 ms | 0 |

Video processing: a 6-second 1280x720 clip with audio is converted to two HLS renditions plus thumbnail in about **2.4 s** (about 0.4x real time with `-preset veryfast`); a 20-second clip took about 9-10 s in the seed script. Browser: the HLS master and first segments load, playback starts at 360p and adapts.

Client bundle: main chunk 302 kB (97 kB gzip); the heavy pages are lazy-loaded (video player 588 kB because of hls.js, instructor dashboard 349 kB because of recharts).

## Known limits (read before the presentation)

1. **Database used in tests.** MongoDB itself cannot be installed in the build sandbox, so the test database is FerretDB (a MongoDB-compatible server). It does not implement `$dateToString`, `$sum: 1` or projection inside `findAndModify`, so the earnings dashboard groups in application code and the seed script avoids `findOneAndUpdate` on `select:false` fields. Everything is plain Mongoose and should run unchanged on MongoDB/Atlas, but run `npm test` once against a real MongoDB (`TEST_MONGO_URI=...`) before you demo.
2. **Not exercised against real external services:** AWS S3 and CloudFront (covered by unit tests with a fake AWS client and a real RSA-signed policy, not by a live bucket), Razorpay order creation (only the network call is stubbed; signature verification, webhook and enrollment logic are real), and Docker (the Dockerfiles and compose file are provided but were not built in the sandbox).
3. **WebRTC mesh** was verified between two real browsers with fake camera devices. Up to 7 participants is a design cap, not a measured result; behind strict NATs you need a TURN server.
4. **CloudFront signed cookies** only work when the CDN hostname shares a parent domain with the app (for example `cdn.example.com` and `app.example.com`); set `VITE_CDN_COOKIE_DOMAIN`.
5. Chat history and room membership are in memory (single API instance). Scaling out needs the Socket.IO Redis adapter.
6. Course thumbnails in the seed data use `picsum.photos` and fall back to a letter tile when offline.
