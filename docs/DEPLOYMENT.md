# Deployment

Target setup that fits free tiers: **MongoDB Atlas** (database), **Render** (API, worker, Redis), **Vercel** (React client), optional **S3 + CloudFront** (video).

## 1. MongoDB Atlas
Create a free cluster, add a database user, allow your host's IP (or 0.0.0.0/0 for a demo), copy the connection string into `MONGO_URI`.

## 2. Redis
BullMQ needs Redis. Use Render Redis, Upstash (use the `rediss://` TCP URL, not the REST URL) or any managed Redis, and set `REDIS_URL`.

## 3. API and worker on Render
Create two services from the `server/` folder (Docker runtime using `server/Dockerfile`, which installs FFmpeg):
- **Web service**: default command. Set `RUN_WORKER_INLINE=false`.
- **Background worker**: command `node src/workers/video.worker.js`.

Both need the same environment variables:

| Variable | Notes |
|---|---|
| `NODE_ENV=production` | enables strict env checks and secure cookies (`SameSite=None; Secure`) |
| `MONGO_URI`, `REDIS_URL` | from steps 1 and 2 |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MEDIA_SIGNING_SECRET` | long random strings |
| `CLIENT_URL` | your Vercel URL (comma-separate multiple) |
| `PUBLIC_API_URL` | the API's public URL |
| `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | for production video storage |
| `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY` | signed delivery (private key with `\n` for newlines) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | test-mode keys |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | optional TURN for live classes |

Important: with the **local** storage driver the web service and the worker must share a disk. On free tiers they do not, so use S3 (or run with `RUN_WORKER_INLINE=true` on a single instance for a demo).

Seed demo data once: run `npm run seed` from a shell on the API service.

## 4. Client on Vercel
Root directory `client`, build `npm run build`, output `dist`. Set `VITE_API_URL=https://<your-api>`. Add a rewrite so deep links work: `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}` in `vercel.json`.

## 5. S3 + CloudFront (video)
1. Private S3 bucket (block public access).
2. CloudFront distribution with the bucket as origin using Origin Access Control; behavior for `videos/*` set to **Restrict viewer access: Yes**, trusted key group.
3. Create a public key and key group, keep the private key for `CLOUDFRONT_PRIVATE_KEY`, put the key ID in `CLOUDFRONT_KEY_PAIR_ID`.
4. Add CORS for your client origin on the bucket and allow `Origin` header forwarding / CORS response policy on CloudFront.
5. Use a CNAME under the same parent domain as the app (for example `cdn.yourdomain.com`) and set `VITE_CDN_COOKIE_DOMAIN=.yourdomain.com` so the browser accepts the signed cookies.

## 6. Razorpay webhook (test mode)
Dashboard > Webhooks > add `https://<your-api>/api/payments/webhook`, events `payment.captured`, `order.paid`, `payment.failed`, secret = `RAZORPAY_WEBHOOK_SECRET`. Test card: any Razorpay test card from their docs.

## 7. Docker (local)
`docker compose up --build` starts Mongo, Redis, API, worker and an nginx container serving the client on http://localhost:8080 (proxying `/api` and `/socket.io`). Set Razorpay keys in your shell first if you want to test payments.
