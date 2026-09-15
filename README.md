# Bureau of Immigration eServices

A responsive private web application based on the supplied TECHNICAL SPECIFICATIONS.docx. This is a working implementation foundation and preview, not an official Bureau of Immigration deployment or a statement of procurement compliance. Use sample data only until the Bureau approves and completes production integration and security acceptance.

## Implemented

- Responsive navy and gold applicant workspace, searchable service catalog, guided forms, and help center.
- Ten services: eTravel, visa waiver, student visa conversion, special study permit, cruise visa waiver, accreditation, annual report, existing school registration, dual citizenship, and WEG.
- Service-specific data capture, required field validation, persistent application drafts with optimistic version checks, document requirements, and submission to the preview's processing queue.
- D1 persistence for profiles, applications, document metadata, and activity history. R2 storage for uploaded files. Data is scoped to the authenticated workspace user.
- Authenticated document download; PDF, JPEG, PNG document uploads; multiple XLSX passenger manifest uploads up to 101 MiB per file; downloadable XLSX header template. Uploaded manifests are stored, not yet converted into individual passenger applications.
- In-app notifications, status refresh every 30 seconds, confirmation downloads, and clearly labeled non-official eTravel QR references.
- Reviewer role enforced server-side using the BI_REVIEWER_EMAILS environment allowlist. Default users are applicants. Reviewer queue, processing notes, decisions, endorsements, and JSON report export. BIIS role synchronization is not connected.
- Payment status surface accurately shows no connected payment channels; no simulated charges or official receipts.
- WebMCP tool opens a supported application form without saving or submitting.

## Run

Requires Node 22.13 or newer. Run npm ci, npm run db:generate only for new schema changes, and npm run build. Apply pending migrations locally using Wrangler as described below, then npm run dev.

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_low_miss_america.sql
```

The portable development preview supplies an isolated local test identity via /signin-with-chatgpt?return_to=/. Production authentication is provided by the private hosting platform, not by browser-supplied user IDs. Keep the service behind that authentication gateway. Do not expose the Worker directly with caller-controlled identity headers.

Production bindings are DB (D1) and BUCKET (R2). Configure BI_REVIEWER_EMAILS to a comma-separated authorized staff email allowlist in the server environment. Do not grant reviewer roles through client-side state. Government identity and role providers must replace the preview identity mapping before official rollout.

## API

All responses use no-store caching. Missing identity is denied. Mutations reject cross-origin requests.

- GET /api/portal: current user's applications, profile, documents, and activity.
- GET /api/portal?review=1: reviewer-only queue, currently capped at 200 applications.
- POST /api/portal: actions save, submit, profile, read, review.
- POST /api/documents?application=ID&kind=REQUIREMENT&name=NAME: authenticated raw file upload. Content-Length is required. File bytes stream to object storage.
- GET /api/documents?id=ID: owner or authorized reviewer document download.

## Production dependencies and specification gaps

The original document also requires a full government enterprise deployment. The following are NOT delivered or certified by this preview:

- Public account registration, independent email verification, MFA, eGovPH SSO, PhilSys verification, BIIS Portal identity synchronization, official eTravel QR validation/scanning and traveler verification, BI systems integration, and future VAMS.
- Authorized Land Bank / Maya collection APIs, assessed fee schedules, signed payment callbacks, reconciliation, official receipts, refunds, and government collection accounting.
- External email/SMS/push delivery. Activity alerts work only within the app.
- Approved service-specific documentary checklists, eligibility rules, workflow routing, assignment/escalation, comprehensive staff management, bulk passenger parsing/validation, administrative monitoring/statistics, and pagination beyond current limits.
- API gateway installation, behavioral API discovery/protection and DDoS controls, malware scanning/content inspection of uploads, comprehensive API traffic logging, immutable audit retention, rate limiting, legal/privacy assessment, penetration testing, load testing, backups and disaster recovery verification.
- BI-hosted infrastructure deployment, native Android/iOS applications, Annex A capacity validation, Annex B exact design matching (annexes were not included in the extracted specification), SLA/24-hour support, vendor certifications, hardware procurement, and organizational compliance obligations.

Before official use, obtain BI-approved requirements and fee rules, connect authorized services, validate data retention and privacy requirements, configure production infrastructure and security controls, run functional/security/capacity acceptance testing, and complete operational turnover.

## Validation performed

TypeScript and production builds; API checks for anonymous denial, persistent draft save/read-back, stale-update rejection, missing fields/documents, upload/download access, submission edit lock, reviewer access denial, cross-origin rejection, and activity history. Browser checks cover opening forms, saving drafts, service-tool valid/invalid inputs, and responsive layouts. The 101 MiB limit is implemented but large-file load testing is still required. Real providers and BI infrastructure cannot be tested without their access and configuration.
