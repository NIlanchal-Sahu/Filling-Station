# API Reference

Base URL: `http://localhost:3001/api/v1`

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Email/password signup |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/google` | Google OAuth token exchange |
| POST | `/auth/otp/send` | Send phone OTP |
| POST | `/auth/otp/verify` | Verify OTP & login |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Request reset email |
| POST | `/auth/reset-password` | Reset with token |
| GET | `/auth/me` | Current user |

## Users & Profiles

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | Any | Get profile |
| PATCH | `/users/me` | Any | Update account |
| GET | `/employers/me` | Employer | Employer profile |
| PATCH | `/employers/me` | Employer | Update employer profile |
| GET | `/students/me` | Student | Student profile |
| PATCH | `/students/me` | Student | Update student profile |
| POST | `/upload/presign` | Any | Get S3 presigned URL |

## Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jobs` | List/search jobs (public filters) |
| GET | `/jobs/nearby` | Geo search (?lat=&lng=&radius=) |
| GET | `/jobs/:id` | Job detail |
| POST | `/jobs` | Create job (Employer) |
| PATCH | `/jobs/:id` | Update job (Employer) |
| DELETE | `/jobs/:id` | Delete job (Employer) |
| GET | `/jobs/my/list` | Employer's jobs |

### Job Query Filters

`search`, `category`, `jobType`, `workMode`, `city`, `minSalary`, `maxSalary`, `freshersOnly`, `remote`, `page`, `limit`

## Applications

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/applications` | Student | Apply to job |
| GET | `/applications/my` | Student | My applications |
| GET | `/jobs/:id/applications` | Employer | Applicants for job |
| PATCH | `/applications/:id/status` | Employer | Update status |
| GET | `/employers/dashboard` | Employer | Dashboard stats |

### Application Statuses

`APPLIED` → `VIEWED` → `SHORTLISTED` → `INTERVIEW_SCHEDULED` → `SELECTED` | `REJECTED`

## Saved Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/saved-jobs` | List saved |
| POST | `/saved-jobs/:jobId` | Save job |
| DELETE | `/saved-jobs/:jobId` | Unsave |

## Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | List conversations |
| POST | `/conversations` | Start conversation |
| GET | `/conversations/:id/messages` | Message history |

### WebSocket Events

```
connect → auth with JWT
join → { conversationId }
message → { conversationId, content, type }
typing → { conversationId }
read → { conversationId, messageId }
schedule_interview → { conversationId, scheduledAt, notes }
```

## Matching

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/matching/job/:jobId` | Top candidates for job |
| GET | `/matching/student/recommendations` | Recommended jobs |

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| PATCH | `/notifications/:id/read` | Mark read |
| POST | `/notifications/register-device` | FCM token |

## Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans` | Subscription plans |
| POST | `/payments/create-order` | Razorpay order |
| POST | `/payments/create-checkout` | Stripe session |
| POST | `/payments/webhook/razorpay` | Razorpay webhook |
| POST | `/payments/webhook/stripe` | Stripe webhook |

## Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/analytics` | Platform stats |
| GET | `/admin/users` | User list |
| PATCH | `/admin/users/:id/suspend` | Suspend user |
| DELETE | `/admin/users/:id` | Delete user |
| GET | `/admin/jobs` | All jobs |
| PATCH | `/admin/jobs/:id/approve` | Approve job |
| DELETE | `/admin/jobs/:id` | Remove spam |
| PATCH | `/admin/employers/:id/verify` | Verify employer |
