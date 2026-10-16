# TaskFlow verification record

TaskFlow is published at [madebylior/taskflow-server](https://github.com/madebylior/taskflow-server). The repository URL has been submitted to the professor, as confirmed by the student. The results below record local testing, not a deployed API.

## Original verification — October 16, 2026

Environment: Windows PowerShell, Node v24.22.0 and npm 11.19.1.

| Command or check | Recorded outcome |
|---|---|
| `npm install` | Completed successfully after allowing network/cache access. The initial dependency tree reported 12 audit findings. |
| Dependency compatibility checks and subsequent `npm install` | SQLite updated to 6.x, a scoped UUID override added for Sequelize, and unused tooling removed. The resulting install reported 0 vulnerabilities. |
| `npm test` | 20 passed, 0 failed, 0 skipped; reported duration 2018.3507 ms. |
| `npm run verify:local` | 30 HTTP status checks passed, plus response-content and SQLite persistence assertions across a server-process restart. |
| `npm run dev` and HTTP health request | Watch-mode server started at `http://127.0.0.1:8000`; health returned `200` with `{"success":true,"status":"ok"}`. |
| Startup configuration checks | Invalid port 70000, a short secret and the example placeholder secret each produced exit code 1 with the expected message. |
| `npm audit` after dependency changes | 0 vulnerabilities at the time of that check. This is not a claim about future audit results. |
| Git ignore checks, staging dry-run and candidate-file scan | `.env`, dependencies and generated databases were excluded; the local JWT secret was absent from files considered for publication. |

## Coverage and limits

- Authentication: registration/login, wrong credentials, duplicate email, public user responses, bcrypt cost 12, and JWT subject, HS256 algorithm and two-hour expiry. Invalid, expired, wrong-signature, wrong-algorithm and nonexistent-user tokens were rejected.
- Ownership: task access and category changes were restricted to the current user. Assigning another user's category was rejected on task creation and update; lists excluded other users' records.
- Database and CRUD: task lifecycle, category creation/listing/renaming/deletion, category-name uniqueness, combined filters, sorting and pagination. Category deletion kept tasks and cleared their category reference.
- Input and errors: invalid body types, unknown fields, booleans, dates, IDs and queries; missing records; malformed and oversized JSON. The server continued responding after invalid requests.
- Central error handling: actual ORM validation/uniqueness checks and deliberately injected Sequelize errors verified status mapping and hidden internal error details. Injected errors tested the handler, not a physical disk failure.
- Rate limiting: both configured limiters were exercised until `429`, with `Retry-After` headers checked. Health remained available.
- Persistence: the actual server restarted against the same SQLite file; login worked and the task retained its title, completion update and category. The script removed its tasks/categories, leaving two test accounts per run in the ignored database.

Thunder Client GUI interaction and the professor's repository access were not verified by these checks. The [Thunder Client guide](THUNDER_CLIENT_GUIDE.md) provides requests for a manual demonstration.

## Documentation review

The README and public guides were checked against `package.json`, the Express routes, controllers, validation middleware and Sequelize models. The private presentation link and obsolete publication/submission steps were removed. This cleanup changes documentation only; backend code and dependencies are unchanged.

The original HTTP, persistence, startup and audit results above remain dated October 16, 2026. Later test runs are recorded separately below.

### Checks during the documentation cleanup

- The first `npm test` attempt could not load missing dependencies. `npm ci` restored the existing lockfile's packages without changing dependency files; installation reported 0 vulnerabilities.
- `npm test` was then rerun successfully: 20 passed, 0 failed, 0 skipped; reported duration 2482.6691 ms, on Node v24.22.0 / npm 11.19.1.
- All six relative Markdown links and anchors resolved to tracked files. All 13 endpoint-table entries matched the Express routes, and documented npm scripts and the Node requirement matched `package.json`.
- Only the three public Markdown files changed. Private documents, `.env`, dependencies and generated database files were not tracked or included in the documentation changes.
- The disk-persistence script, watch-mode demo and startup checks were not rerun during this cleanup; their results remain the original record above.
