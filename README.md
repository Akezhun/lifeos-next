# LifeOS V12.1 — Feature Parity Rebuild

This is the first serious LifeOS 2.0 rebuild after the rough V12 foundation.

Important: do not push this to GitHub yet. Test locally until it feels good enough.

## What changed from V12.0

V12.0 was only a Next.js/Supabase foundation. V12.1 is a feature-parity rebuild that brings back the LifeOS Classic behavior:

- Tracker now has Active/Archive, deadline/cycle/countdown/gray, done/fail/partial, notes, history, edit, delete, tags, status colors and sorting.
- Journals now have Focus Writer, full-size text areas, edit existing entries, sections for Essay/Project/Learning, mood/energy, tags and archive.
- Schedule now has a weekly token board, one-time/recurring/permanent tokens, quick move, duplicate +1 week, delete scopes and overlap warnings.
- Analytics now has multiple dashboards: overview, trackers, journals, schedule, tags and data-science mode.
- Tags are contextual: chips, filters, analytics and per-object tagging, not a separate main module.
- UI has been redesigned to feel closer to a product, not a blank Next.js scaffold.

## Local run

```powershell
cd C:\Dev\lifeos-next
npm install --legacy-peer-deps
npm run dev
```

Open:

```text
http://localhost:3000
```

## Required setup

Use the same `.env.local` from V12:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=LifeOS <onboarding@resend.dev>
LIFEOS_OWNER_EMAIL=akejanduiseen@gmail.com
CRON_SECRET=
```

## Database

If you already ran `supabase/migrations/0001_lifeos2_schema.sql` for V12, you do not need to run it again.

If this is a fresh Supabase project, open Supabase SQL Editor and run:

```text
supabase/migrations/0001_lifeos2_schema.sql
```

## Test order

1. Auth works.
2. Create a tracker.
3. Done/fail/partial changes appear in history.
4. Notes save.
5. Archive/restore works.
6. Create/edit a journal entry in Focus Writer.
7. Create a schedule token and a recurring rule.
8. Select a token, quick move it, save this occurrence.
9. Open Analytics and check graphs.
10. Check tags in Tracker, Journal, Schedule and Analytics.

## Known limitations

This still is not the final LifeOS 2.0. Obsidian sync and production notification worker are still later V12.x steps. But V12.1 is meant to stop being a hollow prototype and start matching the old LifeOS behavior.
