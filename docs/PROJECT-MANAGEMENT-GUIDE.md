# PERGUNU project management guide

This is the current Cloudflare replacement for the original PERGUNU website. The active website is the preview deployment at `https://pergunu-situbondo-preview.fairuz-fuadi04.workers.dev`. It has its own D1 database and R2 bucket.

## 1. How the system fits together

```text
Browser → React UI → /api/* → Cloudflare Worker → D1 database
                                      ├────────→ R2 images and PDFs
                                      ├────────→ Resend email
                                      └────────→ Turnstile verification
```

- **React UI:** the visible site. Vite builds it into `dist/`.
- **Cloudflare Worker:** one backend process that serves both `dist/` and the API. It is started by `worker/index.js`, which loads `worker/routes.js`.
- **D1:** Cloudflare's SQLite database. It stores users, content, applications, sessions, and audit records.
- **R2:** file storage. News images are public; certificates are private and downloaded through a signed-in account request.
- **Resend:** sends invitation, reset, and application emails only when `RESEND_API_KEY` is configured.
- **Turnstile:** anti-bot check for public forms only when `TURNSTILE_SECRET` is configured.

The configuration is `wrangler.jsonc`:

| Environment | Worker | D1 | R2 |
| --- | --- | --- | --- |
| Preview | `pergunu-situbondo-preview` | `pergunu-db-preview` | `pergunu-media-preview` |
| Production | `pergunu-situbondo` | `pergunu-db` | `pergunu-media` |

Production is **not ready**: its D1 database ID is still all zeroes in `wrangler.jsonc`. Do not run production migrations, imports, or deployment until that is replaced with a real production database ID.

## 2. Important folders and files

```text
src/main.jsx                    Actual frontend entry point
src/legacy/App.jsx              Active React routes and original UI
src/legacy/pages/               Full pages: login, admin, member, registration
src/legacy/componen/            Original page sections and admin managers
src/legacy/services/cloudflare.js
                                Compatibility bridge from original UI requests to /api
src/api.js                      Shared JSON API client; sends cookies
worker/routes.js                Every HTTP API route and D1/R2 operation
worker/security.js              Cookies, sessions, passwords, invitation/reset tokens
worker/services.js              Email, R2 helper behavior, audit entries
worker/validation.js            Server-side input and password validation
migrations/0001_initial.sql    Database schema
scripts/                        Admin creation, checks, and legacy import preparation
docs/                           Operating, migration, architecture, and this guide
```

`src/legacy/` is active despite its name. It contains the recovered original design. `src/App.jsx`, `src/AuthContext.jsx`, `src/styles.css`, and `src/assets/` are a previous redesigned frontend and are not mounted by `src/main.jsx`; treat them as duplicate/inactive code until they are deliberately removed.

## 3. Frontend, API, and authentication

`src/main.jsx` calls `synchronizeSession()` and mounts `src/legacy/App.jsx`. The main routes are `/`, `/login`, `/daftar`, `/admin`, `/user-dashboard`, `/berita/:id`, and `/beasiswa/:id`.

The original components use `src/legacy/services/cloudflare.js`. It converts their older request shapes such as `/api/news`, `/api/beasiswa`, `/api/users`, and `/api/applications` into the new Worker routes. New frontend code should prefer `src/api.js` directly; it returns `payload.data` and automatically sends the session cookie.

Authentication works as follows:

1. An admin creates or approves a user.
2. The Worker creates an `auth_tokens` invitation token and the user opens `/atur-password?...`.
3. `POST /api/auth/accept-invitation` hashes the password, activates the user, stores a session in `sessions`, and sets an HTTP-only cookie.
4. `/api/auth/me` reads the cookie. `requireAdmin` protects `/api/admin/*`; `requireUser` protects `/api/account/*`.

The browser's `localStorage` values are only for display compatibility with the original UI. They do not grant access; the Worker cookie and database role do.

Passwords require 8–128 characters. `worker/security.js` uses PBKDF2-SHA256 with 100,000 iterations, which is the highest setting supported by the Cloudflare Worker runtime.

## 4. Database and storage

The full schema is in `migrations/0001_initial.sql`.

| Table | What it stores | Main code that reads/writes it |
| --- | --- | --- |
| `users` | Admins and member accounts, roles, status, profile | `routes.js`: login, approval, admin user routes |
| `sessions` | Hashed browser sessions, 12-hour expiry | `security.js`: `createSession`, `currentUser`, `destroySession` |
| `auth_tokens` | Hashed one-time invitation/reset links | `security.js`: `issueAuthToken`, `consumeAuthToken` |
| `news` | Articles, HTML content, featured flag, R2 image key | `routes.js`: `/api/news` and `/api/admin/news` |
| `scholarships` | Scholarship content, status, deadline, requirements JSON | `routes.js`: `/api/scholarships` and `/api/admin/scholarships` |
| `membership_applications` | Membership registrations and review status | `routes.js`: `/api/membership-applications` and admin applications |
| `scholarship_applications` | Scholarship registrations | `routes.js`: `/api/scholarship-applications` |
| `certificates` | Certificate metadata and private R2 object key | `routes.js`: certificate endpoints |
| `audit_events` | Who changed what and when | `services.js`: `audit()` |
| `rate_limits` | Per-IP attempt counters for login/forms/status checks | `routes.js`: `limited()` |

R2 object paths are:

- News image: `images/<generated-file-name>`; public through `GET /media/images/:key`.
- Certificate: `certificates/<user-id>/<certificate-id>.pdf`; never public. The account owner downloads it through `GET /api/account/certificates/:id/download`.

## 5. Main data flows

### Admin publishes news

```text
AdminDashboard / NewsManager
→ legacy cloudflare bridge
→ POST or PUT /api/admin/news
→ routes.js validates and sanitizes HTML
→ D1 news table (+ R2 when an image was uploaded)
→ JSON response → UI refreshes
```

News content is sanitized in `saveNews()` in `worker/routes.js`. Images go first to `POST /api/admin/media/images`, then the returned `imageKey` is saved in `news.image_key`.

### Public membership registration

```text
RegisterForm
→ POST /api/membership-applications
→ validation + rate-limit + optional Turnstile
→ membership_applications row with an ANG-... reference
→ JSON reference returned to visitor
```

An admin approves it through `PATCH /api/admin/applications/membership/:id`. The Worker creates an invited `users` row if needed, creates an invitation token, and records an audit event.

### Admin login

```text
Login page → POST /api/auth/login
→ users lookup + password hash check
→ sessions row + HTTP-only cookie
→ /api/auth/me → role-based redirect to /admin or /user-dashboard
```

## 6. What to edit for common changes

| Goal | Edit here |
| --- | --- |
| Change visible layout, words, colors, or page behavior | `src/legacy/pages/` or `src/legacy/componen/`, plus its nearby CSS file |
| Add a frontend route | `src/legacy/App.jsx` |
| Add a new API endpoint | `worker/routes.js`, then call it from `src/api.js` or the bridge |
| Change login/session behavior | `worker/security.js` and the relevant auth route in `worker/routes.js` |
| Change server validation | `worker/validation.js` |
| Add a D1 column/table/index | add a new numbered SQL file under `migrations/`; do not edit an already-applied migration |
| Change news/scholarship/application database behavior | `worker/routes.js` and, if needed, `src/legacy/services/cloudflare.js` |
| Change email text or provider behavior | `worker/services.js` |
| Change Worker, D1, R2, or preview settings | `wrangler.jsonc` |

When adding a new field, change all three layers: the D1 migration, the relevant Worker mapping/query, and the frontend form/display. For original UI calls, also update `src/legacy/services/cloudflare.js` so old field names and new API field names stay aligned.

## 7. Daily commands

Run these from the project root.

```bash
# Install dependencies
npm install

# Run locally in separate terminals
npm run dev:worker
npm run dev

# Verify unit tests and production build
npm run check

# Deploy only the isolated preview
npm run deploy:preview

# Create/reset the preview admin invitation
npm run admin:create:preview -- --email admin@example.com --name "Admin Name"

# Apply schema migrations to preview
npm run db:migrate:preview

# Check the live preview routes and API
npm run test:preview
```

Local frontend requests to `/api` and `/media` are proxied from Vite (`http://localhost:5173`) to the local Worker (`http://localhost:8787`) by `vite.config.js`.

Before any production database change, export a backup:

```bash
npx wrangler d1 export pergunu-db --remote --output .generated/backups/pergunu-YYYY-MM-DD.sql
```

Do not run the production command until the production D1 ID is configured and the database ownership is confirmed.

## 8. Troubleshooting checklist

| Symptom | Check first |
| --- | --- |
| `/admin` redirects to login | Confirm the user is `active` and `role = admin`; create a new preview invitation if necessary |
| Login returns 401 | Wrong password, inactive user, or expired session; use Forgot Password after Resend is configured |
| Invitation link fails | It may already be used or expired. Run `admin:create:preview` again to issue a fresh link |
| Invitation returns 500 | Check Cloudflare Worker logs. The password hashing setting must remain at 100,000 iterations or lower for Workers |
| Public form rejects verification | Check `TURNSTILE_SECRET` and `VITE_TURNSTILE_SITE_KEY`; when no secret is configured, Turnstile is skipped |
| Invitation/email is not sent | Check `RESEND_API_KEY`, `RESEND_FROM`, and Resend sender-domain verification |
| Image is missing | Check its `news.image_key` and the matching R2 object under `images/` |
| Certificate cannot download | Confirm the certificate belongs to the logged-in user and its R2 object exists |
| A preview deploy succeeds but nothing changes | Hard refresh, verify the preview URL, then run `npm run test:preview` |

## 9. Current risks and temporary pieces

- **Preview is the only configured environment.** Production database configuration is intentionally incomplete.
- **No legacy personal data has been imported.** `scripts/prepare-legacy-import.mjs` creates a sanitized local SQL file in `.generated/`; do not run a remote import without an approved backup and explicit data-handling decision.
- **Resend and Turnstile are not yet configured for preview.** Do not treat the preview as ready for real public registrations until they are configured.
- **Duplicate inactive frontend files remain in `src/`.** The app uses `src/legacy/`; avoid editing `src/App.jsx` unless you are deliberately replacing the original UI.
- **The compatibility bridge is intentional but fragile.** `src/legacy/services/cloudflare.js` translates old frontend request shapes. Test admin/news/scholarship flows after changing it.
- **The preview admin bootstrap resets that email's password and invitations.** Use `admin:create:preview` only when you intend to issue a fresh activation link.

For regular content work, use the admin dashboard after login. Use code and database commands only when changing the website's features or repairing data.
