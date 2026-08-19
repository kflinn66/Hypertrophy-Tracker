# Getting HyperTrack onto your Android phone

This app is a set of plain HTML/CSS/JS files. To install it as a real app icon on your phone (with offline support and its own storage), it needs to be served from a real web address first — Chrome won't allow "Add to Home Screen" with offline caching from a file sitting in a folder. The free option below (GitHub Pages) takes about 10 minutes, one time.

## 1. Create a free GitHub account (skip if you have one)

Go to [github.com](https://github.com) → Sign up. Free plan is all you need — no credit card.

## 2. Create a new repository

- Click the **+** in the top right → **New repository**
- Name it something like `hypertrophy-tracker`
- Set it to **Public** (required for free GitHub Pages)
- Leave everything else default → **Create repository**

## 3. Upload the app files

- On your new (empty) repo page, click **uploading an existing file**
- Drag in **all the contents** of the `workout-tracker` folder from this zip — `index.html`, `manifest.json`, `service-worker.js`, and the `css`, `js`, and `icons` folders. Keep the folder structure intact (GitHub's drag-and-drop preserves subfolders).
- Scroll down, click **Commit changes**

## 4. Turn on GitHub Pages

- Go to the repo's **Settings** tab → **Pages** (left sidebar)
- Under "Build and deployment" → Source: **Deploy from a branch**
- Branch: **main**, folder: **/ (root)** → **Save**
- Wait about a minute, then refresh — GitHub will show your live URL, something like:
  `https://YOUR-USERNAME.github.io/hypertrophy-tracker/`

## 5. Install it on your phone

- Open that URL in **Chrome on your Android phone**
- You should see an **"Install App"** button appear in the bottom right (or use Chrome's 3-dot menu → **Install app** / **Add to Home screen**)
- Confirm — you'll get a HyperTrack icon on your home screen that opens full-screen, no browser bar

That's it. From then on, opening the app from your home screen works even with no signal, since the service worker caches everything the first time you load it online.

## Updating the app later

When we make changes, you'll upload the new files the same way (Settings → your repo → Add file → Upload files, overwrite the existing ones, commit). GitHub Pages rebuilds in under a minute. On your phone, just close the app fully and reopen it — the service worker checks for updates in the background and will serve the new version on the next full reload.

## Your data

Everything you log stays in your phone's local app storage (IndexedDB) — nothing is sent anywhere, since there's no backend server, just static files. Use **Settings → Export Backup** inside the app now and then to save a `.json` copy, just in case you ever uninstall the app or clear its storage.
