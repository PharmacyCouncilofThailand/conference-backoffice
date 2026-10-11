# ACCP Backoffice

Admin dashboard for ACCP Conference management.

## Quick Start

```bash
npm install --legacy-peer-deps
npm run dev
```

## Available Scripts

| Command                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Start development server (port 3001)               |
| `npm run build`        | Build for production                               |
| `npm run start`        | Start production server                            |
| `npm run lint`         | Run ESLint                                         |
| `npm run format`       | Format source code and documentation with Prettier |
| `npm run format:check` | Check formatting without changing files            |

Prettier uses two-space indentation, single quotes, trailing commas, and LF line endings. Generated files, lockfiles, environment files, and public assets are excluded. Run `npm run format` to apply formatting to existing code.

## Environment Variables

Copy `.env.example` or create `.env`:

```
NEXT_PUBLIC_API_URL=http://localhost:3002
```

## Deploy to Netlify

1. Create a new Netlify site from this repository.
2. Set **Base directory** to `accp-backoffice`.
3. Use the project `netlify.toml` in this folder:
   - Build command: `npm run build`
   - Node version: `20`
   - NPM flags: `--legacy-peer-deps`
4. Add production environment variables in Netlify:
   - `NEXT_PUBLIC_API_URL=https://<your-api-domain>`
5. Trigger deploy and verify key flows:
   - backoffice login
   - protected routes (events, abstracts, speakers, registrations)
   - upload/proxy related pages

### Required API-side updates

Before go-live, update backend (`accp-api`) environment values:

- `CORS_ORIGIN=https://<web-domain>,https://<backoffice-domain>`
- `API_BASE_URL=https://<api-domain>`

## Features

- User management
- Event management
- Registration management
- Abstract submissions
- Speaker management
- Check-in system
