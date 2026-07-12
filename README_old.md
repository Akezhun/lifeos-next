# LifeOS 2.0 — V12 Foundation

LifeOS V12 is the beginning of the new architecture:

- **Next.js / React** for the app UI.
- **Supabase Postgres** as the real database.
- **Supabase Auth** for login.
- **Vercel** for deployment.
- **Scheduled notification worker** for email reminders.
- **GitHub Vault** becomes an Obsidian Markdown mirror, not the main database.

## 1. Install locally

```powershell
cd C:\Dev\lifeos-next
npm install
copy .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

## 2. Supabase setup

Open Supabase → SQL Editor → paste and run:

```text
supabase/migrations/0001_lifeos2_schema.sql
```

Then fill `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=LifeOS <onboarding@resend.dev>
LIFEOS_OWNER_EMAIL=akejanduiseen@gmail.com
CRON_SECRET=your-long-secret
```

## 3. First login

Go to `/auth`, create an account with your email and password, then return to Home.

## 4. Import old LifeOS Classic data

Go to `/import` and upload/paste:

- `tasks.json`
- `journals.json`
- `schedule.json`

The importer stores old object IDs as `legacy_id`, but creates clean database rows in Supabase.

## 5. Deploy to Vercel

1. Push this project to `Akezhun/lifeos-next`.
2. Import the repo in Vercel.
3. Add all environment variables in Vercel → Project → Settings → Environment Variables.
4. Deploy.

## 6. What is included in V12

- New visual shell and redesign foundation.
- Supabase Auth.
- Postgres schema for Trackers, Journals, Schedule, Tags, Notifications, Settings, Obsidian sync logs.
- Functional basic Trackers.
- Functional basic Journals.
- Functional basic Schedule board/list.
- Functional basic Analytics.
- Old JSON import page.
- Notification settings page.
- Notification worker endpoint: `/api/notifications/check`.

## 7. What is not finished yet

This is the new foundation, not the final LifeOS 2.0 replacement yet.

Next steps:

- V12.1: stronger Tracker parity with LifeOS Classic.
- V12.2: full Journal Focus Writer + sections.
- V12.3: Schedule drag/drop board in React.
- V12.4: Obsidian sync worker.
- V12.5: production notifications: email + Telegram.
- V13: final product polish and app-like UX.
