# Deployment Guide

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://localjob:localjob_secret@localhost:5432/localjob
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=localjob-uploads
AWS_REGION=ap-south-1
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GOOGLE_MAPS_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
REDIS_URL=redis://localhost:6379
FRONTEND_URL=https://your-app.vercel.app
PORT=3001
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
NEXT_PUBLIC_RAZORPAY_KEY=
```

### Mobile (`mobile/.env`)

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
EXPO_PUBLIC_SOCKET_URL=https://api.yourdomain.com
```

---

## PostgreSQL (Production)

**Recommended**: [Neon](https://neon.tech), [Supabase](https://supabase.com), or AWS RDS.

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
```

---

## Backend (AWS / DigitalOcean)

### Docker

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

```bash
docker build -t localjob-api ./backend
docker run -p 3001:3001 --env-file backend/.env localjob-api
```

### DigitalOcean App Platform

1. Connect GitHub repo
2. Set root directory: `backend`
3. Build: `npm ci && npx prisma generate && npm run build`
4. Run: `npx prisma migrate deploy && node dist/main.js`
5. Add managed PostgreSQL + Redis

---

## Frontend (Vercel)

1. Import repo, set root: `frontend`
2. Framework: Next.js
3. Add env vars from `.env.local`
4. Deploy

---

## Mobile (EAS)

```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure
eas build --platform all
eas submit
```

Configure `app.json` with bundle IDs and FCM credentials.

---

## SSL & CORS

- API behind HTTPS (Let's Encrypt / load balancer)
- Set `FRONTEND_URL` for CORS
- Socket.io with same origin or configured CORS

---

## Monitoring

- **Logs**: CloudWatch / DO Logs
- **Errors**: Sentry (`@sentry/node`, `@sentry/nextjs`)
- **Uptime**: Better Stack / Pingdom

---

## CI/CD (GitHub Actions example)

```yaml
name: Deploy API
on:
  push:
    branches: [main]
    paths: ['backend/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd backend && npm ci && npm run build
      - run: cd backend && npx prisma migrate deploy
      # Add your deploy step (ECS, DO, etc.)
```
