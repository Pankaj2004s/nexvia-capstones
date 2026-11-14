# LearnSphere: Learning Management System with Live Classes

A full online school: courses, HLS video lessons, live classes (WebRTC), auto-graded quizzes, PDF certificates and an instructor revenue dashboard. Built for project **FS-03** on the MERN stack.

| Brief requirement | Where it lives |
|---|---|
| Roles (student / instructor / admin), course, lesson, enrollment schema | `server/src/features/*/**.model.js`, RBAC in `shared/middleware/auth.js` |
| Video upload, **FFmpeg in a BullMQ job** to streaming formats | `features/video/` (queue, worker, processor, ffmpeg) |
| Video delivery through **CloudFront** | `shared/storage/delivery.js` (signed cookies) + S3 adapter, local signed fallback |
| Quizzes, auto-grading, progress tracking | `features/quizzes`, `features/progress` |
| Live classes with **WebRTC** + chat | `features/liveclasses` (Socket.IO signaling), `client/src/pages/LiveRoom.jsx` |
| PDF certificates on completion | `features/certificates` (pdfkit, public verify page) |
| Instructor revenue dashboard + payments (test mode) | `features/payments` (Razorpay), `features/earnings` |
| **Redux Toolkit** | `client/src/app/slices.js` |
| Feature-based monolith with modularity | one Express app; each feature is a self-contained folder |

## Quick start (local)

Prerequisites: Node 20+, MongoDB, Redis, FFmpeg (`ffmpeg` and `ffprobe` on PATH).

```bash
# 1. API
cd server
cp .env.example .env            # defaults work for local dev
npm install
npm run seed -- --video         # demo users, 12 courses, quizzes, one real processed video
npm run dev                     # API + inline video worker on :5000, Swagger at /api/docs

# 2. Client (new terminal)
cd client
npm install
npm run dev                     # http://localhost:5173 (proxies /api and /socket.io to :5000)
```

Or everything in containers: `docker compose up --build` then open http://localhost:8080 (see `docs/DEPLOYMENT.md`).

**Demo logins** (password `Demo@1234`): `admin@learnsphere.dev`, `instructor@learnsphere.dev`, `instructor2@learnsphere.dev`, `student@learnsphere.dev`, `student2@learnsphere.dev`.

## Scripts

| Where | Command | What |
|---|---|---|
| server | `npm run dev` / `npm start` | run the API (inline worker when `RUN_WORKER_INLINE=true`) |
| server | `npm run worker` | standalone video worker process (production) |
| server | `npm test` / `npm run test:coverage` | Jest + Supertest (68 tests) |
| client | `npm test` | Vitest (10 tests) |
| e2e | `python e2e/e2e_student_flow.py` | real-browser tests with Playwright (see `docs/RESULTS.md`) |

## How this was built

AI-assisted: the code was written with Claude (Anthropic) and then verified by the automated and browser tests described in `docs/RESULTS.md`. Update this paragraph with your own account of what you ran, changed and deployed.

## Documentation

- `docs/ARCHITECTURE.md`: architecture diagram, data model, key flows
- `docs/RESULTS.md`: test results, coverage, performance numbers, known limits
- `docs/DEPLOYMENT.md`: Atlas, Render, Vercel, S3 + CloudFront, Razorpay webhook
- `docs/LEARNING_NOTES.md`: how each module works and the concepts used (read this before presenting)
- `docs/PRESENTATION_OUTLINE.md`: 10-minute talk plan and demo script
- API reference: run the server and open `/api/docs` (Swagger UI)
