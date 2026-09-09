# Bhumi Landmarks — Premium Land Sale Website

A premium, conversion-focused land developer website (React + Express).
Original brand and content, inspired by the structure of premium
real-estate experiences.

## Stack

- **Frontend:** React 18 (Vite), React Router, hand-written CSS design system
- **Backend:** Node.js + Express REST API serving all content
- **Images:** free Unsplash photography (downloaded locally, see `scripts/fetch-images.sh`)

## Run in development

```bash
npm install            # root (concurrently)
npm run install:all    # server + client deps

npm run dev            # API on :4000, client on :5173 (proxied)
```

Open http://localhost:5173

## Production (single Node server)

```bash
npm run build          # builds client to client/dist
npm start              # Express serves API + built client on :4000
```

## Deploy to Vercel

The repo is configured for Vercel out of the box (`vercel.json`):

- `client/dist` is deployed as the static site
- `api/index.mjs` runs the Express API as a serverless function at `/api/*`
- SPA rewrites keep deep links like `/plots/GV-A-014` working

**Via CLI (from this folder):**

```bash
npx vercel login       # first time only
npx vercel             # preview deploy
npx vercel --prod      # production deploy
```

**Via dashboard:** push this folder to a GitHub repo, import it at
vercel.com/new — framework detection comes from `vercel.json`.

> Note: serverless functions have a read-only filesystem, so inquiries are
> logged to the Vercel function logs instead of `inquiries.log.json`. For a
> real deployment, wire `api/index.mjs` / `server/app.js` to a database
> (Mongo, Postgres, Supabase…) or an email/notification service.

## Where things live

| What                | Where                                  |
| ------------------- | -------------------------------------- |
| Company info        | `server/data/settings.js`              |
| Projects            | `server/data/projects.js`              |
| Plots               | `server/data/plots.js`                 |
| Amenities, testimonials, gallery, location copy | `server/data/content.js` |
| Colors / typography | `client/src/styles.css` (`:root` tokens) |
| Photos              | `client/public/images/`                |
| Inquiries (form posts) | `server/data/inquiries.log.json`    |

## API

- `GET /api/bootstrap` — everything the site needs in one call
- `GET /api/projects`, `GET /api/projects/:slug`
- `GET /api/plots?project=&type=&size=&minPrice=&maxPrice=&status=`
- `GET /api/plots/:id`
- `POST /api/inquiries` — contact form
- plus individual endpoints for settings, amenities, testimonials, gallery…

## Replacing placeholder content

All names, prices, phone numbers, stats and testimonials are realistic
placeholders. Swap the data files above — no component changes needed.
