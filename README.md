# LifeOS V12.6 — Settings, Users, Notifications, Media

This build combines the pre-Obsidian-remaster block:

- **V12.3 Settings Core**: language, theme, timezone, week start, start page, compact mode, module preferences.
- **V12.4 User System Polish**: account page, logout, password reset, private preview / public signup flag, user profile.
- **V12.5 Notifications Hardening**: email + Telegram channels, daily/evening/weekly rules, worker status, manual worker run, notification log.
- **V12.6 Media Update**: media library, URL previews, images, YouTube embeds, Spotify/Apple/links cards, media linked to journal entries / trackers.

Next major block after this: **Obsidian Sync 2.0 / remaster**.

## Install / update locally

```powershell
cd C:\Dev
Expand-Archive "$env:USERPROFILE\Downloads\LifeOS_V12_6_Core_Media.zip" -DestinationPath C:\Dev\LifeOS_V12_6_unpack -Force
robocopy C:\Dev\LifeOS_V12_6_unpack\LifeOS_V12_6_Core_Media C:\Dev\lifeos-next /E /XD node_modules .next .git .vercel /XF .env.local
cd C:\Dev\lifeos-next
npm install --legacy-peer-deps
npm run dev
```

## Required database upgrade

In Supabase SQL Editor run:

```text
supabase/migrations/0002_v12_6_settings_users_media.sql
```

Run this **after** your existing V12.1/V12.2 schema. It adds settings columns, user profiles, media_items and deleted_items.

## Environment variables

Keep secrets in `.env.local` locally and Vercel Environment Variables in production. Never commit `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ALLOW_PUBLIC_SIGNUP=false
LIFEOS_OWNER_EMAIL=akejanduiseen@gmail.com

CRON_SECRET=
RESEND_API_KEY=
EMAIL_FROM=LifeOS <onboarding@resend.dev>
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

GITHUB_TOKEN=
GITHUB_VAULT_REPO=Akezhun/life-tracker-vault
GITHUB_VAULT_BRANCH=main
GITHUB_VAULT_ROOT=LifeOS
```

## GitHub Actions worker

The existing workflow calls:

```text
/api/notifications/check
```

Repository secrets needed:

```text
LIFEOS_APP_URL=https://your-vercel-url.vercel.app
LIFEOS_CRON_SECRET=same value as CRON_SECRET
```

## Check after update

1. `/settings` — save language/theme/timezone, export backup, run health check.
2. `/notifications` — save email/Telegram channels, test email/Telegram, run worker manually.
3. `/media` — add image URL, YouTube URL, Spotify/Apple/article link.
4. `/journals` — edit an entry and attach a media URL to it.
5. `/analytics` — confirm existing progress maps still work.

## Notes

- Supabase remains the main database.
- GitHub Vault is not the main DB anymore. It returns later as Obsidian Markdown mirror.
- Vercel cron is still not required. Use GitHub Actions / Render / Supabase Cron for the worker.
