# Sleeve

[![Open Sleeve](https://img.shields.io/badge/Open_Sleeve-live-90a88b?style=for-the-badge)](https://sleeve.lukedigiovanna.workers.dev)
[![Database setup](https://img.shields.io/badge/Database-Supabase-3ecf8e?style=for-the-badge)](#set-up-your-own-instance)
[![Install app](https://img.shields.io/badge/Install-PWA-68788d?style=for-the-badge)](#install-the-app)

A personal album listening journal. Find albums, log listens with ratings and notes, and browse your library by artist, genre, or instrument. Track your vinyl collection and wishlist, too.

The [design guide](docs/design-guide.md) describes Sleeve’s editorial approach to catalog pages and interactions.

## Set up your own instance

Requires Node.js 22.18+ and a [Supabase](https://supabase.com/) project for the database and email/password authentication.

1. Install dependencies and copy the environment template:

   ```sh
   npm ci
   cp .env.example .env
   ```

2. In your Supabase project's SQL Editor, run **all** files in [supabase/migrations](supabase/migrations) in filename order. These create the schema, per-user access policies, and save functions. The app does not apply migrations automatically.

3. Set these values in `.env` using your project's URL and public publishable key:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

   Never use a service-role or secret key in the frontend.

4. In Supabase **Authentication → URL Configuration**, set the Site URL to your app's URL and allow `http://localhost:5173/` as a redirect URL for local development. Allow your deployed URL too, so signup confirmation emails can return to the app.

5. Start the app, then sign up to create your account:

   ```sh
   npm run dev
   ```

Restart the dev server after changing `.env`. Without Supabase configuration, you can explore the demo instead.

To host your instance on Cloudflare Workers, configure your own Worker name in [wrangler.jsonc](wrangler.jsonc), authenticate Wrangler with your Cloudflare account, and run `npm run deploy`. The Supabase environment variables must be available when building; they are embedded in the frontend bundle.

## Image storage

Signed-in saves import new album art, artist photos, and instrument images into
Supabase Storage as optimized WebP files (768px maximum, 50 KB target, 100 KB
ceiling). Before using image imports, follow the [image storage setup guide](docs/image-storage.md)
to run the migration and configure the Cloudflare Worker's Supabase credentials.
The guide explains image processing, migration of existing URLs, caching, and cleanup.

## Install the app

Open [Sleeve](https://sleeve.lukedigiovanna.workers.dev) or your own HTTPS deployment:

- **iPhone / iPad:** In Safari, choose **Share → Add to Home Screen**. Enable **Open as Web App** if offered.
- **Android:** In Chrome's menu, choose **Install app** or **Add to Home screen**.
- **Desktop:** Use the install icon in the address bar or the browser's **Install app** menu option, when available.

Launch Sleeve from its new icon and sign in. The installed app may use a separate session from your browser.

After an online account load, your library is available for offline browsing, including previously cached artwork. Album lookup and saving changes require a connection. Clearing browser storage removes offline data.
