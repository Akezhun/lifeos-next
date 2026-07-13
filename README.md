# LifeOS V12.2 — Progress Maps + Real Notifications Worker

LifeOS 2.0 is now Next.js + Supabase + Vercel.

V12.2 adds two important systems:

1. **Tracker Progress Maps** in Analytics
   - daily cycle cubes;
   - weekly/monthly cycle blocks;
   - deadline race palette from green to black;
   - countdown chain where Done closes the current segment and starts the next one.

2. **Notifications Worker via GitHub Actions**
   - Vercel cron stays disabled for Hobby compatibility;
   - GitHub Actions calls `/api/notifications/check` every 15 minutes;
   - LifeOS sends email through Resend;
   - notification log prevents duplicate messages.

## Local update

Replace the current project files with this version, then:

```powershell
cd C:\Dev\lifeos-next
npm install --legacy-peer-deps
npm run build
npm run dev
```

## GitHub update

After local build passes:

```powershell
git add .
git commit -m "LifeOS V12.2 progress maps and notifications"
git push
```

Vercel will redeploy automatically.

## Vercel environment variables

Required:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=LifeOS <onboarding@resend.dev>
LIFEOS_OWNER_EMAIL=akejanduiseen@gmail.com
CRON_SECRET=
```

`CRON_SECRET` must be a long random string.

## GitHub Actions secrets

In GitHub repo `Akezhun/lifeos-next`:

`Settings → Secrets and variables → Actions → New repository secret`

Create:

```text
LIFEOS_APP_URL=https://your-vercel-url.vercel.app
LIFEOS_CRON_SECRET=same value as Vercel CRON_SECRET
```

Then open:

`Actions → LifeOS Notifications Worker → Run workflow`

If the run is green, scheduled email notifications are connected.

## Notifications page

Open `/notifications` and save rules:

- Email target
- Deadline reminders: `1440, 180, 60`
- Schedule reminders: `15`
- Cycle ending reminder: `180`
- Countdown reminder: `60`
- Daily brief time: `08:00`

Then click **Send test email**.

## Notes

- GitHub Vault is not the main database anymore.
- Supabase is the source of truth.
- GitHub Actions worker is the temporary always-on scheduler.
- App push/PWA push can come later.
