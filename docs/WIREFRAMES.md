# UI Wireframes

## Design System

- **Primary**: Blue `#0A66C2` (LinkedIn-inspired)
- **Accent**: Green `#057642` (success/hired)
- **Background**: Slate `#F3F2EF`
- **Typography**: Inter / system sans
- **Components**: shadcn/ui (web), custom RN components (mobile)

---

## Public Pages

### Home
```
┌─────────────────────────────────────────────────────────┐
│ [Logo LocalJob]     Jobs  About  Pricing  [Login][Join] │
├─────────────────────────────────────────────────────────┤
│  Find Local Jobs Near You                               │
│  [Search jobs, skills, companies...        ] [Search]   │
│  [Part-time] [Internship] [Remote] [Freshers]           │
├─────────────────────────────────────────────────────────┤
│  Featured Jobs (cards grid)                             │
│  How It Works (3 steps)                                 │
│  For Employers CTA                                      │
└─────────────────────────────────────────────────────────┘
```

### Pricing
```
Free | Premium Employer ₹999/mo | Premium Student ₹299/mo
Feature comparison table + Razorpay/Stripe checkout
```

---

## Employer Flow

### Dashboard
```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │  Active Jobs: 12  │ Applicants: 48           │
│          │  New: 8 │ Shortlisted: 15 │ Hired: 3        │
│ Dashboard│  Recent Applications table                   │
│ Post Job │  Quick Actions: [Post Job] [View Messages]   │
│ Jobs     │                                              │
│ Applicants│                                             │
│ Messages │                                              │
│ Settings │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Create Job (multi-step)
1. Basic info (title, category, type)
2. Compensation & openings
3. Requirements (skills, education, experience)
4. Location & work mode
5. Description & deadline → Publish

### Applicants
- Filters: status, search, sort by match score
- Actions: Shortlist, Reject, Message, Download Resume, Hire

---

## Student Flow

### Job Search
```
┌──────────┬──────────────────────────────────────────────┐
│ Filters  │  [Search bar]                    [Map view] │
│ Salary   │  Job cards with match % badge                 │
│ Location │  Save ♡  Apply                                │
│ Type     │                                               │
│ Remote   │                                               │
└──────────┴──────────────────────────────────────────────┘
```

### Application Tracker
Timeline UI: Applied → Viewed → Shortlisted → Interview → Selected/Rejected

---

## Admin

```
Analytics cards | User table with suspend/verify | Job moderation queue
```

---

## Mobile (Expo)

| Screen | Notes |
|--------|-------|
| Splash / Onboarding | Role selection |
| Login / Signup | Google + OTP tabs |
| Home (Student) | Search + nearby jobs map |
| Job Detail | Apply, save, match score |
| Employer Dashboard | Stats cards |
| Chat | Bubble UI, image picker |
| Profile | Edit sections |
| Notifications | Push + in-app list |

Navigation: Bottom tabs (Home, Jobs, Applications, Messages, Profile)
