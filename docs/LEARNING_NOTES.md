# Learning notes: how LearnSphere works (read before presenting)

Each section: **what it does**, **how**, **concepts you should be able to name**, **likely question + answer**, and a short Hinglish summary.

---

## 0. The big picture
Browser (React) talks to one Express API over REST and Socket.IO. MongoDB stores data. Redis + a worker process do slow jobs (video conversion). Files live behind a "storage adapter" so the same code runs on local disk or S3.

**Hindi me:** frontend sirf API se baat karta hai. Bhaari kaam (video convert) request ke andar nahi hota, queue me jaata hai aur worker alag se karta hai.

Concepts: *monolith vs microservices, feature-based modules, separation of concerns (routes -> service -> model), adapter pattern.*

---

## 1. Auth and roles (`features/auth`, `shared/middleware/auth.js`)
**What:** register, login, refresh, logout; three roles.
**How:**
- Password is hashed with **bcrypt** (never stored plain).
- Login returns a short-lived **access JWT** (15 min) in the response body, and a **refresh token** in an **httpOnly cookie** (JavaScript cannot read it, so XSS cannot steal it). The refresh token is stored only as a SHA-256 hash in the DB.
- **Token rotation:** every refresh issues a new refresh token and invalidates the old one. Each token has a random `jti`, otherwise two tokens created in the same second could be identical (a real bug our test caught).
- `authenticate` middleware verifies the bearer token and sets `req.user`; `authorize('instructor','admin')` checks the role.
**Concepts:** JWT, middleware, hashing vs encryption, httpOnly cookies, RBAC, rate limiting, user enumeration (same error for wrong email and wrong password).
**Q:** Why not keep the JWT in localStorage? **A:** Any XSS can read localStorage. The access token lives only in memory; the long-lived one is httpOnly.
**Hindi me:** access token chhota aur memory me; refresh token cookie me, JS padh nahi sakta.

## 2. Courses, lessons, enrollments (`features/courses`, `lessons`, `enrollments`)
**What:** instructor creates a draft, adds lessons, submits for review; admin approves; students see only published courses.
**How:** status machine `draft -> pending -> published/rejected`. Ownership check `assertManage` runs before every instructor change (an instructor cannot edit someone else's course). Catalog supports search, filters, sorting and pagination; user text is regex-escaped so `.*(` cannot break or abuse the query. `Enrollment(user, course)` has a **unique index**, so enrolling twice is impossible and `enrollUser` is idempotent.
**Concepts:** REST, pagination, indexes, unique constraints, authorization vs authentication, validation with zod.

## 3. Video pipeline (`features/video`) - the star feature
**What:** upload a video, get adaptive streaming.
**How (follow the code in this order):**
1. `video.routes.js`: **multer** receives the upload on disk (500 MB limit, only `video/*`).
2. `video.service.upload`: stores the original through the storage adapter, creates a `Video` document (`queued`), and calls `enqueueVideo`.
3. `video.queue.js`: **BullMQ** `Queue` puts a job in **Redis**. Options: 3 attempts, exponential backoff.
4. `video.worker.js`: a **Worker** (separate process in production) picks up jobs, concurrency 2.
5. `video.processor.js`: downloads the original, `ffprobe` reads size/duration, `ffmpeg` creates **HLS** renditions (360p and 720p, H.264 + AAC, 6-second `.ts` segments) and a `master.m3u8` that lists them; also a thumbnail. Progress is parsed from ffmpeg's `-progress` output and saved so the UI can show a bar. Output uploads to storage, status becomes `ready`, the lesson gets its duration.
6. Failure: the processor re-throws, BullMQ retries; only the last attempt sets `failed`.
**Concepts:** message queue, producer/consumer, background job, retries and backoff, idempotency, HLS, adaptive bitrate streaming, transcoding, child processes (`spawn`), 202 Accepted.
**Q:** Why a queue instead of converting inside the upload request? **A:** Conversion takes seconds to minutes; a request would time out, block the server and lose the job on a crash. The queue survives restarts and retries.
**Hindi me:** upload ke baad API turant 202 deta hai; worker background me ffmpeg chalata hai; browser har 2 second me progress poochta hai.

## 4. Secure delivery (`shared/storage/delivery.js`, `media` route)
**What:** only people with access can watch, and links expire.
**How:** `GET /lessons/:id/playback` first checks access (enrolled, owner, admin, or free preview). Then:
- **CloudFront mode:** a **custom policy** (wildcard resource `https://cdn/videos/<id>/*` + expiry) is signed with your RSA private key and returned as three **signed cookies**; the browser sends them with every segment request. (A *canned* policy cannot contain `*`, which our test caught.)
- **Local mode:** a short-lived JWT scoped to that video folder; `/api/media/*` verifies it and rewrites playlist lines so every segment URL carries the token.
**Concepts:** CDN, signed URLs/cookies, least privilege, prefix scoping (`videos/abc` must not match `videos/abcd`), path traversal protection.

## 5. Quizzes and progress (`features/quizzes`, `progress`)
**What:** instructors build quizzes; grading happens on the server.
**How:** `sanitize()` removes `isCorrect` for students. `grade()` is a pure function: a multi-select answer is correct only if the selected set equals the correct set. `Progress` stores completed lesson ids; percent = completed / total lessons. `completionStatus` = 100% lessons **and** every quiz passed.
**Concepts:** never trust the client, pure functions (easy to unit test), `$addToSet` (idempotent update).

## 6. Certificates (`features/certificates`)
**What:** PDF on completion + public verification.
**How:** **pdfkit** draws a landscape A4 PDF into a Buffer; stored via the adapter; `certId` is random (`LS-` + 12 hex). Unique index on (user, course) prevents duplicates even with two parallel requests. `/certificates/verify/:id` is public so an employer can check it.

## 7. Payments and earnings (`features/payments`, `earnings`)
**What:** Razorpay test-mode checkout, instructor revenue.
**How:** (1) server creates an order (amount in paise); (2) browser opens Razorpay Checkout; (3) the response includes `order_id|payment_id|signature`; the server recomputes `HMAC_SHA256(order_id|payment_id, secret)` and compares with a **timing-safe** equal; (4) `markPaid` uses a **conditional update** (`status != paid`) so only the first of {verify call, webhook} wins; that winner enrolls the student and writes an `Earning` (80/20 split; unique per payment). The webhook route receives the **raw body** because the signature is over exact bytes.
**Concepts:** HMAC, signatures, idempotency, webhooks, race conditions, raw body parsing, money in smallest unit.
**Q:** What if the user closes the tab after paying? **A:** The webhook still arrives and enrolls them.
**Hindi me:** payment sach me hua ya nahi, ye signature se server verify karta hai, frontend ke bharose nahi.

## 8. Live classes (`features/liveclasses`, `LiveRoom.jsx`)
**What:** video class with chat.
**How:** **WebRTC** moves audio/video **peer to peer**. The server only does **signaling** through Socket.IO: it relays SDP **offers/answers** and **ICE candidates** between two peers in the same room. When you join, you (the new joiner) create an offer for each existing participant (**mesh topology**). `ontrack` gives you their stream. STUN helps find public addresses; TURN relays when direct connection is impossible. Server checks: valid JWT on the socket, class must be `live`, user must be the instructor or enrolled, max 7 participants, signals only between sockets in the same room.
**Concepts:** WebRTC, SDP, ICE/STUN/TURN, signaling, mesh vs SFU, Socket.IO rooms/namespaces, `RTCPeerConnection`, `getUserMedia`.
**Q:** Why max 7? **A:** In a mesh every person uploads their video to every other person; bandwidth grows with N. For big classes use an SFU (LiveKit).

## 9. Frontend (Redux Toolkit, `client/src`)
- `lib/api.js`: fetch wrapper; access token in memory; on 401 it calls `/auth/refresh` once and retries.
- `app/slices.js`: **createSlice** (reducers) + **createAsyncThunk** (async API calls with pending/fulfilled/rejected states): auth, catalog, learning, instructor, admin, ui (toasts).
- `RequireAuth` guard redirects to login and checks roles. Heavy pages are **lazy-loaded** (code splitting).
- `VideoPlayer.jsx`: asks for a playback session, **hls.js** attaches the stream to `<video>` (Safari plays HLS natively); polls while the video is still processing.
**Concepts:** state management, thunks, immutable updates (Immer inside RTK), route guards, code splitting, controlled inputs, `useEffect` cleanup (destroy hls, close sockets).

## 10. Error handling, validation, testing
- One `AppError` class + central `errorHandler` maps Mongoose duplicate-key to 409, validation to 400, JWT errors to 401, upload size to 413.
- `zod` validates body/query/params before controllers run.
- Tests: unit (grading, storage), integration (Supertest + real DB), pipeline (real FFmpeg + Redis), sockets (real clients), browser E2E (Playwright). A good talking point: **tests found real bugs** (token rotation, auth middleware scope, CloudFront policy, lesson auto-jump).

---

## 20 questions to practise
1. Why queue + worker for video? 2. What is HLS and why 6-second segments? 3. How do you stop non-enrolled users watching? 4. Why httpOnly refresh cookie? 5. What does the unique index on Enrollment give you? 6. How is a payment verified? 7. What if the webhook and verify call arrive together? 8. Why raw body for the webhook? 9. How does grading avoid leaking answers? 10. What is signaling in WebRTC? 11. STUN vs TURN? 12. Mesh vs SFU? 13. How do you prevent two certificates? 14. What happens when FFmpeg fails? 15. How does CloudFront authorize a request? 16. Why a custom policy? 17. What is idempotency? 18. How did you structure features to stay modular? 19. What would break at 10,000 users? (in-memory chat, single Socket.IO node, grouping in app code, local disk) 20. What did tests catch?
