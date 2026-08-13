# Pump-Store (LocalJob) — Student Job Marketplace

A full-stack platform connecting **students, freshers, and part-time workers** with **local SMB employers**.

## Stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 15, React, TypeScript, Tailwind, shadcn/ui |
| Mobile | React Native (Expo) |
| API | NestJS, Socket.io |
| Database | PostgreSQL + Prisma |
| Auth | JWT, Google OAuth, OTP |
| Storage | AWS S3 |
| Payments | Razorpay, Stripe |
| Maps | Google Maps API |
| Push | Firebase Cloud Messaging |

## Project Structure

```
local-job/
├── backend/          # NestJS API
├── frontend/         # Next.js 15 web app
├── mobile/           # Expo React Native app
├── docs/             # Architecture, API, deployment
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL) or local PostgreSQL
- npm

### 1. Database

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API runs at `http://localhost:3001`

### 3. Web Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Web runs at `http://localhost:3000`

### 4. Mobile

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

## Documentation

- [System Architecture](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [UI Wireframes](./docs/WIREFRAMES.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## User Roles

- **Employer** — Post jobs, manage applicants, chat with candidates
- **Student/Job Seeker** — Search jobs, apply, track applications
- **Admin** — User/job moderation, analytics, verification

## License

MIT
