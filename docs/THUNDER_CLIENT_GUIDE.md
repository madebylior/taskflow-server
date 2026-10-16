# TaskFlow with Thunder Client

This guide walks through a local demo in VS Code. Install the Thunder Client extension and follow the [README setup](../README.md#installation-and-setup), then run `npm run dev` and keep the terminal open.

Base URL: `http://127.0.0.1:8000/api/v1`. Paths below are relative to this address. If you change `PORT`, use that port instead.

## 1. Check the server

Click New Request, choose GET and enter `http://127.0.0.1:8000/api/v1/health`. Click Send. Expected `200`:

```json
{"success":true,"status":"ok"}
```

## 2. Register or log in

Send `POST /auth/register`. Under Body → JSON, enter:

```json
{"name":"Lior","email":"lior@example.com","password":"TestPassword123"}
```

Expected `201`. The response contains `data.user` and `data.token`, without a password hash. Registration requires a name of 2–80 characters, a valid email and a password of at least 8 characters and at most 72 UTF-8 bytes.

If the email is already registered, registration returns `409`. Use `POST /auth/login` instead:

```json
{"email":"lior@example.com","password":"TestPassword123"}
```

Expected `200`, with a token in `data.token`. A wrong email/password combination returns `401`.

For every protected request below, select Auth → Bearer Token and paste only the token string, without another `Bearer` prefix. This sets `Authorization: Bearer YOUR_TOKEN`. Use Body → JSON for POST/PATCH requests so the JSON content type is set.

Try `GET /auth/me`: expected `200` with your public user fields. Tokens expire after two hours; log in again when needed.

## 3. Create a category and task

Send `POST /categories`:

```json
{"name":"College"}
```

Expected `201`. Save `data.id` as your category ID. If you already created that name, list categories with `GET /categories` and reuse its ID, or choose a new name.

Send `POST /tasks`, replacing `categoryId` below with that ID:

```json
{
  "title":"Study Full Stack",
  "description":"Review routes, middleware and Sequelize",
  "completed":false,
  "priority":"high",
  "dueDate":"2026-10-20",
  "categoryId":1
}
```

Expected `201` with the saved task in `data`. Save its `id`. Only `title` is required (2–120 characters). Completion defaults to `false` and priority to `medium`. Dates use `YYYY-MM-DD`; description is limited to 1000 characters. Do not send `userId`: the server sets the owner.

## 4. Read, filter and update

Use your real task ID for `GET /tasks/1`: expected `200`. List tasks with `GET /tasks`, or combine filters:

```http
GET /tasks?search=Stack&completed=false&priority=high&categoryId=1&sort=title&order=asc&page=1&limit=10
```

Replace the category ID too. The response includes `data` and `pagination: {page, limit, total, pages}`. Use [the README query table](../README.md#request-examples) for all accepted values. Search matches partial titles and supports SQL LIKE wildcards `%` and `_`; priority sorting is alphabetical.

Send `PATCH /tasks/1` with:

```json
{"completed":true}
```

Expected `200` with `completed: true`. The task should now disappear from a list filtered by `completed=false`. Other fields can be updated in the same way. To clear optional fields, use `{"description":null,"dueDate":null,"categoryId":null}`.

Rename the category with `PATCH /categories/1` and `{"name":"University"}`: expected `200`. Category names must be 2–60 characters and unique within your account.

## 5. Show validation and ownership

Keep your task and category until after these checks:

| Request | Expected |
|---|---|
| PATCH your task with `{"completed":"false"}` | 400: a string is not a Boolean |
| POST a task with `{"title":"Invalid date","dueDate":"2026-02-30"}` | 400 |
| GET `/tasks?limit=101` or `/tasks?completed=maybe` | 400 |
| GET `/tasks/abc` | 400: invalid ID |
| GET `/tasks` without a token, or with a bad token | 401 |
| GET a task ID that does not exist | 404 |
| POST the same category name twice | 409 |

Unknown body fields and query parameters also return `400`. A JSON body over 20 KB returns `413`, and malformed JSON returns `400`. Errors use `{success:false, error:{code, message}}`.

To demonstrate ownership:

1. Save user A's token, task ID and category ID.
2. Register a second account with `{"name":"Dana","email":"dana@example.com","password":"TestPassword123"}`. If it exists, log in instead.
3. Use B's token to list tasks: only B's tasks should appear. Reading, updating or deleting A's task returns `404`.
4. Try creating a task with A's category ID: `404`. Renaming or deleting A's category also returns `404`.
5. Switch back to A's token and fetch the task to confirm it is unchanged by B's requests.

## 6. Show persistence, then delete

Stop the API with Ctrl+C and run `npm run dev` again. Log in and fetch your saved task ID. Its fields should still be present in SQLite.

Delete its category with `DELETE /categories/1`, using the real ID. Expected `200`. Fetch the task: it remains, with `categoryId: null`. If you already cleared the category in step 4, reassign it first to demonstrate this behavior.

Delete the task with `DELETE /tasks/1`: expected `200`. Fetch it again: expected `404`.

## Rate limits and troubleshooting

- Registration and login share a limit of 10 requests per IP per 15 minutes, including successes. The 11th returns `429`. The general API limit is 120 requests per 15 minutes. Health stays available.
- After `429`, wait for the `Retry-After` interval or restart the local server to reset its in-memory counters before continuing the demo.
- Connection refused: check that the server is running and the URL matches its port.
- `401`: add the Bearer token or log in for a fresh one.
- `404`: check the ID and which user's token you selected.
- `409`: log in for an existing email, or choose a different category name.
- Unexpected `500`: read the server terminal for details.

Run `npm test` for automated checks using separate in-memory databases. With the normal server stopped, `npm run verify:local` performs 30 HTTP checks and verifies persistence across a restart. It leaves two test accounts per run in the configured local database. See the [verification record](VERIFICATION.md) for recorded results; these scripts do not automate Thunder Client's interface.
