# Deploy GridClash to Vercel

Deploy the **entire `web` folder**, including `api`, `lib`, `dist`, `package.json` and `vercel.json`. Uploading only `dist` runs the game but cannot save analytics.

1. Put this web project in your GitHub repository and import it into Vercel. Set Root Directory to `web` if the repository contains the outer GridClash folder; use the repository root if it contains these web files directly.
2. Use the **Other** framework preset. `vercel.json` sets the output directory to `dist` and requires no build step. Node.js 24 is declared in `package.json`.
3. Create an **Upstash Redis** database in your own Upstash account, or connect it through Vercel Marketplace. In Vercel's project Environment Variables, add:

   | Name | Value |
   | --- | --- |
   | `UPSTASH_REDIS_REST_URL` | The database's HTTPS REST URL |
   | `UPSTASH_REDIS_REST_TOKEN` | Its write-capable REST token |
   | `ANALYTICS_ADMIN_PASSWORD` | Your own unique password, at least 20 characters |

   Keep these values server-side; never put them in `dist`, Git, screenshots or a `NEXT_PUBLIC_` variable. Set them for Production; use a separate database for Preview if you enable preview tracking so tests do not enter public totals. Redeploy after adding or changing variables.
4. Open the deployed game. Make a move, finish a game, and visit **`https://your-domain/admin`**. Enter the password you chose. Refresh the dashboard to see the counts. No account registration is needed for players.
5. Share the game's root URL publicly; keep your dashboard password private. The `/admin` page is a login screen; its statistics API requires your password on every request.

## What is counted

- **Page views:** each game page load, including refreshes.
- **Visits:** browser-tab sessions. Refreshes in the same tab do not add a new visit.
- **Unique visitors:** estimated unique browsers using a random local-storage identifier; not verified people. Clearing storage, using private browsing or changing browsers can count again.
- **Games started:** first actual move on a fresh board, including a computer-first move. Merely opening the game, changing options or clicking Start fresh without playing does not add a game.
- **Games completed:** the first time all boxes are claimed in that match. Undoing and replaying a completed match does not add another completion. A new match can count again.
- **Daily activity:** East Africa Time. The dashboard shows 30 days; daily aggregates and duplicate-event records expire after 90 days. Lifetime totals and a compact visitor estimate remain.

Player names, emails, moves and scores are not sent to analytics. Public `/privacy` explains the counts and lets visitors opt out. Statistics can miss blocked/offline requests and are not bot-proof or billing-grade. They start when this version is deployed, not retroactively.

## Local use

`npm start` serves the game, analytics API, `/privacy`, and `/admin` at http://127.0.0.1:4173. Without Redis variables it stores local-only counters in ignored `.data/analytics.json`. To unlock local analytics, copy `.env.example` to `.env.local`, set `ANALYTICS_ADMIN_PASSWORD`, and restart. Use a different password from production. Local data is not automatically transferred to Vercel.

Production deliberately returns an analytics configuration error if Redis is missing. It never pretends that temporary Vercel instance memory is durable storage. The game keeps working if analytics is unavailable. A blank dashboard is not proof tracking works: check `/api/events` returns 200 and `/api/stats` returns totals after you sign in.

## Provider documentation

- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/environment-variables
- https://upstash.com/docs/redis/features/restapi
