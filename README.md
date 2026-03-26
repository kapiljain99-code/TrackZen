# Trackzen

Trackzen is a FastAPI + SQLite + vanilla JavaScript streak tracker with:

- signup/login
- 4-digit recovery PIN reset flow
- JWT authentication
- mission tracking
- daily check-ins
- learning journal
- leaderboard
- light/dark theme

## Local Run

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

## Production Environment Variables

Use these in your hosting dashboard:

- `APP_ENV=production`
- `SECRET_KEY=<your-long-random-secret>`
- `DATABASE_PATH=/data/streaks.db`

Important:

- `SECRET_KEY` must be set in production.
- `DATABASE_PATH` should point to a persistent disk path if your host supports persistent storage.
- If Stepify does not persist local disk between deploys/restarts, SQLite is not enough and you will need a managed database instead.
- Old local users created before the recovery PIN feature may not have a PIN set in the database.

## Stepify Deploy Settings

If Stepify asks for commands, use:

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:$PORT main:app
```

## Docker Deploy

If your platform supports Docker deploys, this repo now includes a `Dockerfile`.

Required environment variables:

- `APP_ENV=production`
- `SECRET_KEY=<your-long-random-secret>`
- `DATABASE_PATH=/data/streaks.db`

## Health Check

This app exposes:

```text
/health
```

## Notes

- Static HTML, CSS, and JS are served by FastAPI from the repo root.
- The app is same-origin in production, so the frontend works without changing API URLs.
