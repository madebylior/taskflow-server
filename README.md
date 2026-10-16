# TaskFlow — Student Task Manager API

TaskFlow is my final project for the Full Stack – Server course. It is a REST API for managing personal tasks and categories. Each user can register, log in and manage their own data. There is no frontend; I use Thunder Client to send requests and demonstrate the API.

## Technologies

- Node.js 20.17 or newer and Express
- Sequelize ORM with SQLite
- JWT for authentication and bcrypt for password hashing
- express-rate-limit, Helmet and dotenv

The code is organized into routes, controllers, models and middleware. Routes select the action, middleware checks authentication and input, and controllers use Sequelize models to read or change data. Errors go through one error handler.

## Main features

- Registration, login and a current-user endpoint
- Create, read, update and delete tasks; create, list, rename and delete categories
- Search task titles, combine filters, sort results and use pagination
- Private tasks and categories: users can access only their own records
- Input validation and consistent JSON error responses

## Installation and setup

Open the project folder containing `package.json`, then install dependencies:

```bash
npm install
```

Copy the configuration example to `.env`:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Keep the port and database path below, and replace `JWT_SECRET` with your own random value of at least 32 characters. The example placeholder will be rejected.

```dotenv
PORT=8000
NODE_ENV=development
JWT_SECRET=replace_with_your_own_random_secret_at_least_32_characters
DB_STORAGE=./data/taskflow.sqlite
```

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and paste the output into `.env`. Do not commit `.env` or share the secret.

Start the server from the project root:

```bash
npm run dev
```

The API listens locally at `http://127.0.0.1:8000`. Check `GET /api/v1/health`; it returns `{"success":true,"status":"ok"}`. Watch mode restarts after source changes; `npm start` runs without watching. Stop with Ctrl+C. If port 8000 is busy, change `PORT` and use that port in your requests.

SQLite stores data in `data/taskflow.sqlite`, which is created automatically. No separate database server is needed. `.env`, `node_modules/` and generated database files are ignored by Git.

## Database models and relationships

Sequelize defines the models and runs SQL queries against SQLite. On startup, `sequelize.sync()` creates missing tables.

| Model | Main fields |
|---|---|
| User | `id`, `name`, unique `email`, `passwordHash` |
| Task | `id`, `title`, optional `description`, `completed`, `priority`, optional `dueDate`, `userId`, optional `categoryId` |
| Category | `id`, `name`, `userId`; category names are unique per user |

All models have timestamps. A user has many tasks and categories. A task belongs to one user and optionally one category. Deleting a category keeps its tasks and sets their `categoryId` to `null`.

## API endpoints

Base URL: `http://127.0.0.1:8000/api/v1`

| Method | Path | Purpose | Token | Success |
|---|---|---|---|---|
| GET | `/health` | Health check | No | 200 |
| POST | `/auth/register` | Register | No | 201 |
| POST | `/auth/login` | Log in | No | 200 |
| GET | `/auth/me` | Current user | Yes | 200 |
| GET | `/tasks` | List/filter tasks | Yes | 200 |
| GET | `/tasks/:id` | Get one task | Yes | 200 |
| POST | `/tasks` | Create task | Yes | 201 |
| PATCH | `/tasks/:id` | Update task fields | Yes | 200 |
| DELETE | `/tasks/:id` | Delete task | Yes | 200 |
| GET | `/categories` | List categories | Yes | 200 |
| POST | `/categories` | Create category | Yes | 201 |
| PATCH | `/categories/:id` | Rename category | Yes | 200 |
| DELETE | `/categories/:id` | Delete category | Yes | 200 |

Send JSON bodies with `Content-Type: application/json`. For protected requests, add `Authorization: Bearer YOUR_TOKEN`. Registration and login return the token in `data.token`; it expires after two hours. Passwords are stored as bcrypt hashes and are never returned.

## Request examples

Register with `POST /auth/register`:

```json
{"name":"Lior","email":"lior@example.com","password":"TestPassword123"}
```

The `201` response contains `success: true` and `data: { user, token }`. To log in, send the same email and password to `POST /auth/login`, without `name`; success returns `200` with the same response structure.

With your token, create a category using `POST /categories` and `{"name":"College"}`. Then create a task using `POST /tasks`, replacing `categoryId` with the returned ID:

```json
{"title":"Study Full Stack","description":"Review Express routes","completed":false,"priority":"high","dueDate":"2026-10-20","categoryId":1}
```

Creation returns `201` with `success: true` and the saved task in `data`, including its ID. The server sets `userId` from the authenticated user. Use the actual task ID in `PATCH /tasks/1` with `{"completed":true}` or `DELETE /tasks/1`.

Combine filters in a GET request:

```http
GET /tasks?search=Stack&completed=false&priority=high&categoryId=1&sort=title&order=asc&page=1&limit=10
```

| Query | Accepted values |
|---|---|
| `search` | Partial title, up to 100 characters; SQL LIKE wildcards `%` and `_` work |
| `completed`, `priority` | `true` / `false`; `low` / `medium` / `high` |
| `categoryId` | Positive category ID |
| `sort`, `order` | `createdAt` (default), `dueDate`, `title`, `priority`; `asc` / `desc` (default) |
| `page`, `limit` | Page 1–10000 (default 1); limit 1–100 (default 20) |

Lists return `{success, data, pagination: {page, limit, total, pages}}`. Priority sorting is alphabetical. Task defaults are `completed: false` and `priority: "medium"`. Dates use `YYYY-MM-DD`; `description`, `dueDate` and `categoryId` can be cleared with `null`.

Invalid input returns `400`, missing/invalid authentication `401`, missing or other users' records `404`, duplicates `409`, oversized JSON `413`, rate limits `429`, and unexpected server errors `500`. For example:

```json
{"success":false,"error":{"code":"VALIDATION_ERROR","message":"completed must be true or false"}}
```

The limits are 120 API requests per IP per 15 minutes, with 10 combined registration/login requests in that period. Successful attempts count. Health checks are outside these limits; counters reset on restart. JSON bodies are limited to 20 KB.

## Testing

Run `npm test` for integration tests covering authentication, ownership, CRUD, validation, errors, filtering and rate limits. These use isolated in-memory SQLite databases rather than your local data.

With the normal server stopped and a valid `.env`, run `npm run verify:local` to test the actual server over HTTP and confirm SQLite persistence across a restart. It uses the configured database, removes its tasks/categories and leaves two test accounts per run.

The [verification record](docs/VERIFICATION.md) distinguishes the original test results from later checks.

## Trying the API

See the [Thunder Client guide](docs/THUNDER_CLIENT_GUIDE.md) for a complete demo, including login, ownership checks and expected error responses.
