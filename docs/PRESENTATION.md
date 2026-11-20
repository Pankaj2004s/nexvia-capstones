# 10-minute presentation plan

| Time | Section | What to show / say |
|---|---|---|
| 0:00 | Problem | Online schools need more than video: live interaction, assessment, proof of completion, and a way for teachers to earn. |
| 1:00 | Design | Architecture diagram (`docs/ARCHITECTURE.md`): feature-based monolith, Redis + worker for video, adapters for storage/CDN, Socket.IO only for signaling. Say why: easy to deploy, modules can be split later. |
| 2:30 | Live demo 1 (student) | Catalog search, free preview (adaptive HLS), enroll, finish lessons, quiz, certificate PDF, public verify page. |
| 4:30 | Live demo 2 (instructor) | Create course, upload a video and **watch the queue progress**, quiz builder, submit; admin approves. |
| 6:00 | Live demo 3 (live class) | Two windows: instructor goes live, student joins, video both ways, chat, end class. |
| 7:00 | Challenges | Pick 3 real ones: (1) video processing off the request path (queue, retries, idempotency); (2) idempotent payments (verify + webhook both fire); (3) auth middleware scoped wrongly blocked public routes (caught by tests); (4) CloudFront wildcard needs a custom policy. |
| 8:30 | Results | 68 API tests, 10 client tests, 23 browser steps; 88.7% line coverage; processing 6 s of 720p in about 2.4 s; catalog p50 181 ms on the sandbox DB. Be upfront about the limits in `docs/RESULTS.md`. |
| 9:30 | Next steps | SFU (LiveKit) for large classes, Redis adapter for sockets, S3 multipart uploads from the browser, subtitles, Razorpay live mode and refunds, aggregation pipelines for large earnings data. |

## Reflection prompts (write the answers in your own words)

The individual reflection must describe what **you** learned and owned. Be accurate about how the code was produced (AI-assisted) and about the parts you personally ran, tested, debugged, deployed and can explain. Questions to answer honestly:

1. Which three modules can I explain line by line without notes? (Use `LEARNING_NOTES.md` until the answer is true for at least video, payments and live classes.)
2. What did I run and verify myself (tests, demo, deployment), and what did I change?
3. What was the hardest concept (queues, WebRTC signaling, idempotency, signed URLs) and how did I come to understand it?
4. What would I do differently or build next?
