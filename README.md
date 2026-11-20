# Nexvia Full Stack Projects

Two full stack projects by Pankaj Sharma, each in its own folder with its own README, tests and documentation.

| Project | What it is | Live | Docs |
| --- | --- | --- | --- |
| [FS-01 ShopSphere](FS-01) | Multi-vendor marketplace: products, cart, orders, search with Elasticsearch, Redis caching, Razorpay test payments, image storage adapters | https://fs-01-shopsphere.vercel.app | [README](FS-01/README.md), [reflection](FS-01/docs/REFLECTION.md), [presentation](FS-01/docs/PRESENTATION.md) |
| [FS-03 LearnSphere](FS-03) | Learning platform: video lessons (FFmpeg and BullMQ), live classes (WebRTC), quizzes, certificates, instructor earnings, Razorpay test payments | __WEB_URL__ | [README](FS-03/README.md), [reflection](FS-03/docs/REFLECTION.md), [presentation](FS-03/docs/PRESENTATION.md) |

Both are MERN projects deployed with Vercel (client), Render (API) and MongoDB Atlas. The free Render plans sleep when idle, so the first request to an API can take about a minute.

## Layout

```
FS-01/        ShopSphere (client, server, docs)
FS-03/        LearnSphere (client, server, e2e, docs)
render.yaml   Render Blueprint for the LearnSphere API
```

The history of both projects is kept, so `git log -- FS-01` and `git log -- FS-03` show the commits of each one.
