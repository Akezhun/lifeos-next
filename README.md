# LifeOS V14.1 — True Multi-user + Owner Mode Final

This build makes LifeOS one real multi-user app instead of a personal app with multi-user as an afterthought.

## Main model

- Supabase remains the main database.
- Every row belongs to a user via `user_id` and RLS.
- The app is always multi-user.
- Akezhan is simply the first `owner` user.
- Extra personal functions are controlled by role + feature flags.

## New in V14.1

- Owner/admin role detection via `LIFEOS_OWNER_EMAIL`.
- Signup modes:
  - `public`
  - `invite`
  - `private`
- Invite-code registration.
- Owner/admin invite panel in Settings → Account.
- Users list for owner/admin.
- Per-user feature flags:
  - Personal Tools
  - Obsidian Sync
  - Admin panel
  - Experimental features
- Per-user workspace name.
- Better profile initialization after sign-in/sign-up.
- V14 offline/local-first layer remains included.

## Required Supabase migration

Run this SQL in Supabase SQL Editor:

```text
supabase/migrations/0006_v14_1_true_multiuser_owner_mode.sql
```

## Environment variables

Recommended final setup:

```env
LIFEOS_OWNER_EMAIL=akejanduiseen@gmail.com
LIFEOS_SIGNUP_MODE=invite
ALLOW_PUBLIC_SIGNUP=false
```

If you want anyone to register without invites:

```env
ALLOW_PUBLIC_SIGNUP=true
```

If you want only the owner to use it:

```env
LIFEOS_SIGNUP_MODE=private
ALLOW_PUBLIC_SIGNUP=false
```

## Local update

```powershell
cd C:\Dev
Expand-Archive "$env:USERPROFILE\Downloads\LifeOS_V14_1_TrueMultiUser_Final.zip" -DestinationPath C:\Dev\LifeOS_V14_1_unpack -Force

robocopy C:\Dev\LifeOS_V14_1_unpack\LifeOS_V14_1_TrueMultiUser_Final C:\Dev\lifeos-next /E /XD node_modules .next .git .vercel /XF .env.local

cd C:\Dev\lifeos-next
npm install --legacy-peer-deps
npm run build
npm run dev
```

## Deployment

After local build:

```powershell
git add .
git commit -m "LifeOS V14.1 true multi-user final"
git push
```

Then redeploy on Vercel if needed.
