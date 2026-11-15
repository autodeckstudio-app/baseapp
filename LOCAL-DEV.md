# Run AutoDeck on your own computer

This lets you see every change on your own screen in seconds, without waiting for a deploy. Everything is in git. Deploys become occasional.

The repo has these apps:

| App | Folder | Tech | Run command |
| --- | --- | --- | --- |
| Admin | `apps/admin` | Next.js website | `pnpm --filter @autodeck/admin dev` |
| Studio | `apps/studio` | Expo (phone and web) | `pnpm --filter @autodeck/studio start` |
| Customer | `apps/customer` | Expo (phone and web) | `pnpm --filter @autodeck/customer start` |

If a `--filter` name does not match, open the app's `package.json` and use its `"name"` value.

## 1. Install the tools (once)

1. **VS Code**: https://code.visualstudio.com (download, install, open it).
2. **Git**: https://git-scm.com/downloads (on a Mac, typing `git` in Terminal offers to install it). Keep the default options on Windows.
3. **Node 20 or newer (LTS)**: https://nodejs.org . Check it with `node -v` in a terminal. It should print v20 or higher.
4. **pnpm**: this repo uses pnpm, not npm. In a terminal run:
   ```
   corepack enable
   corepack prepare pnpm@9.15.0 --activate
   pnpm -v
   ```
   If `corepack` is not found, run `npm install -g pnpm@9.15.0` instead.

To open a terminal in VS Code: menu Terminal, then New Terminal.

## 2. Get the code (once)

1. In VS Code, open the Accounts icon (bottom left) and choose **Sign in with GitHub**. Use the GitHub account that has access to `autodeckstudio-app`.
2. Press `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`), type **Git: Clone**, press Enter, choose **Clone from GitHub**, pick `autodeckstudio-app/baseapp`, and choose a folder. Click **Open** when it asks.
3. In the VS Code terminal run:
   ```
   pnpm install
   ```
   The first install takes a few minutes.

## 3. Add the Firebase settings (once)

The apps need your Firebase web config to talk to the backend. These are the same values the live apps use.

1. Find them in the Firebase console: Project settings, then Your apps, then the web app, then the config values. They are also in the Vercel project's Environment Variables.
2. Create `apps/admin/.env.local` with:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
3. Create `apps/studio/.env` (and `apps/customer/.env` if you run it) with the same values, but with the prefix `EXPO_PUBLIC_` instead of `NEXT_PUBLIC_`:
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```
4. `.env.example` at the repo root lists every variable. These files are ignored by git, so they never get uploaded. Do not paste secret keys into chat.

Note: with these values you are signing in to the real backend, so changes you make in the app change real data. Admin sign-in from `localhost` also needs `localhost` in Firebase console, Authentication, Settings, Authorized domains (it is normally there by default). Admin sign-in uses a server session route that needs the `FIREBASE_SERVICE_ACCOUNT_KEY` value from `.env.example`. If admin sign-in fails locally with a session error, that is the missing piece. Ask for it and put it in `apps/admin/.env.local`.

## 4. Run an app

**Admin (website):**
```
pnpm --filter @autodeck/admin dev
```
Open http://localhost:3000 . It reloads when you save a file.

**Studio in the browser:**
```
cd apps/studio
pnpm exec expo start --web
```
Open the address it prints (usually http://localhost:8081).

**Studio on your phone:**
1. Install **Expo Go** from the App Store or Play Store.
2. Run `cd apps/studio` then `pnpm exec expo start`.
3. Scan the QR code with the phone camera (iPhone) or inside Expo Go (Android). The phone and the computer must be on the same Wi-Fi.
4. If it cannot connect, run `pnpm exec expo start --tunnel` instead.

**Customer app:** same as Studio, from `apps/customer`.

Stop any app with `Ctrl+C` in its terminal.

## 5. Keep your computer in sync with git

Git does not sync live. It syncs when you fetch or pull. VS Code can make this nearly automatic:

1. Open Settings (`Ctrl+,`), search **git.autofetch**, and turn it on. VS Code then checks GitHub every few minutes.
2. When the bottom-left status bar shows an arrow with a number (for example `↓2`), there are new changes on GitHub.
3. Click **Sync Changes** in the Source Control panel (the branch icon on the left), or click the circular arrow in the bottom bar. That pulls the new commits and pushes yours.

Simple habit:
- Before you start work: click Sync Changes.
- After you finish: commit with a short message, then click Sync Changes again.

If you have edited files and not committed them, and Sync complains, commit first (or ask before discarding anything).

Changes pushed from elsewhere (for example from Cloud Shell) reach your computer on the next fetch or sync. After a sync, the running dev server reloads on its own. If new packages were added, run `pnpm install` again.

## 6. Common problems

- `pnpm: command not found`: redo step 1.4, then close and reopen the terminal.
- Port already in use: stop the other run with `Ctrl+C`, or add `-p 3001` to the admin command.
- Blank page after pulling: run `pnpm install`, then restart the app.
- Windows: if scripts are blocked in PowerShell, use the VS Code terminal's **Command Prompt** or **Git Bash** profile.
