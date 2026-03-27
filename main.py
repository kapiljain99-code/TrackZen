from datetime import date, datetime, timedelta
import os
from pathlib import Path
import sqlite3
from typing import Optional

import bcrypt
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
APP_ENV = os.getenv("APP_ENV", "development").lower()
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", str(BASE_DIR / "streaks.db")))
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-development")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7

if APP_ENV == "production" and SECRET_KEY == "change-this-secret-key-in-development":
    raise RuntimeError("Set a strong SECRET_KEY environment variable in production.")

app = FastAPI(title="Trackzen")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthPayload(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=6, max_length=100)


class SignupPayload(AuthPayload):
    recovery_pin: str = Field(min_length=4, max_length=4)


class MissionPayload(BaseModel):
    mission: str = Field(min_length=1, max_length=120)


class LearningPayload(BaseModel):
    learned_today: str = Field(min_length=1, max_length=600)


class ResetPasswordPayload(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    recovery_pin: str = Field(min_length=4, max_length=4)
    new_password: str = Field(min_length=6, max_length=100)


def get_db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def create_tables() -> None:
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            recovery_pin_hash TEXT DEFAULT '',
            mission TEXT DEFAULT '',
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_active_date TEXT
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            learned_today TEXT DEFAULT '',
            UNIQUE(user_id, date),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )

    user_columns = {
        column_info["name"]
        for column_info in cursor.execute("PRAGMA table_info(users)").fetchall()
    }
    if "recovery_pin_hash" not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN recovery_pin_hash TEXT DEFAULT ''")

    existing_columns = {
        column_info["name"]
        for column_info in cursor.execute("PRAGMA table_info(checkins)").fetchall()
    }
    if "learned_today" not in existing_columns:
        cursor.execute("ALTER TABLE checkins ADD COLUMN learned_today TEXT DEFAULT ''")

    connection.commit()
    connection.close()


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    create_tables()


initialize_database()


@app.on_event("startup")
def startup() -> None:
    initialize_database()


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: int, username: str) -> str:
    expires_at = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "username": username, "exp": expires_at}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def parse_token(authorization: Optional[str] = Header(default=None)) -> sqlite3.Row:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization token.",
        )

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    connection = get_db_connection()
    user = connection.execute(
        "SELECT * FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    connection.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    return user


def get_today_learning_text(user_id: int) -> str:
    today_text = date.today().isoformat()
    connection = get_db_connection()
    row = connection.execute(
        "SELECT learned_today FROM checkins WHERE user_id = ? AND date = ?",
        (user_id, today_text),
    ).fetchone()
    connection.close()
    return row["learned_today"] if row and row["learned_today"] else ""


def validate_entry_date(entry_date: str) -> str:
    try:
        return date.fromisoformat(entry_date).isoformat()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")


def serialize_user(user: sqlite3.Row) -> dict:
    today = date.today().isoformat()
    learned_today = get_today_learning_text(user["id"])
    return {
        "id": user["id"],
        "username": user["username"],
        "mission": user["mission"] or "",
        "current_streak": user["current_streak"],
        "longest_streak": user["longest_streak"],
        "last_active_date": user["last_active_date"],
        "done_today": user["last_active_date"] == today,
        "learned_today": learned_today,
        "can_check_in_today": bool(learned_today.strip()) and user["last_active_date"] != today,
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "environment": APP_ENV,
        "database_path": str(DATABASE_PATH),
    }


def get_learning_history(user_id: int) -> list[dict]:
    connection = get_db_connection()
    rows = connection.execute(
        """
        SELECT date, learned_today
        FROM checkins
        WHERE user_id = ? AND TRIM(COALESCE(learned_today, '')) != ''
        ORDER BY date DESC
        """,
        (user_id,),
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/login.html", status_code=status.HTTP_302_FOUND)


@app.get("/login.html")
def login_page() -> FileResponse:
    return FileResponse(BASE_DIR / "login.html")


@app.get("/signup.html")
def signup_page() -> FileResponse:
    return FileResponse(BASE_DIR / "signup.html")


@app.get("/dashboard.html")
def dashboard_page() -> FileResponse:
    return FileResponse(BASE_DIR / "dashboard.html")


@app.get("/reset.html")
def reset_page() -> FileResponse:
    return FileResponse(BASE_DIR / "reset.html")


@app.get("/style.css")
def style_file() -> FileResponse:
    return FileResponse(BASE_DIR / "style.css", media_type="text/css")


@app.get("/script.js")
def script_file() -> FileResponse:
    return FileResponse(BASE_DIR / "script.js", media_type="application/javascript")


def validate_recovery_pin(recovery_pin: str) -> str:
    pin = recovery_pin.strip()
    if len(pin) != 4 or not pin.isdigit():
        raise HTTPException(status_code=400, detail="Recovery PIN must be exactly 4 digits.")
    return pin


@app.post("/signup")
def signup(payload: SignupPayload) -> dict:
    initialize_database()
    username = payload.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    recovery_pin = validate_recovery_pin(payload.recovery_pin)

    connection = get_db_connection()
    existing_user = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()

    if existing_user:
        connection.close()
        raise HTTPException(status_code=400, detail="Username already exists.")

    try:
        connection.execute(
            """
            INSERT INTO users (username, password_hash, recovery_pin_hash, mission, current_streak, longest_streak, last_active_date)
            VALUES (?, ?, ?, '', 0, 0, NULL)
            """,
            (username, hash_password(payload.password), hash_password(recovery_pin)),
        )
        connection.commit()
    except sqlite3.IntegrityError:
        connection.close()
        raise HTTPException(status_code=400, detail="Username already exists.")
    except sqlite3.Error as exc:
        connection.close()
        raise HTTPException(status_code=500, detail=f"Database error during signup: {exc}")

    user = connection.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    connection.close()

    token = create_access_token(user["id"], user["username"])
    return {"message": "Signup successful.", "token": token, "user": serialize_user(user)}


@app.post("/login")
def login(payload: AuthPayload) -> dict:
    username = payload.username.strip()
    connection = get_db_connection()
    user = connection.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    connection.close()

    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_access_token(user["id"], user["username"])
    return {"message": "Login successful.", "token": token, "user": serialize_user(user)}


@app.post("/reset-password")
def reset_password(payload: ResetPasswordPayload) -> dict:
    username = payload.username.strip()
    recovery_pin = validate_recovery_pin(payload.recovery_pin)

    connection = get_db_connection()
    user = connection.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,),
    ).fetchone()

    if not user:
        connection.close()
        raise HTTPException(status_code=404, detail="User not found.")

    stored_pin_hash = user["recovery_pin_hash"] or ""
    if not stored_pin_hash or not verify_password(recovery_pin, stored_pin_hash):
        connection.close()
        raise HTTPException(status_code=401, detail="Invalid recovery PIN.")

    connection.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (hash_password(payload.new_password), user["id"]),
    )
    connection.commit()
    connection.close()

    return {"message": "Password reset successful. Please login with your new password."}


@app.get("/me")
def get_me(current_user: sqlite3.Row = Depends(parse_token)) -> dict:
    return serialize_user(current_user)


@app.put("/mission")
def update_mission(
    payload: MissionPayload,
    current_user: sqlite3.Row = Depends(parse_token),
) -> dict:
    mission = payload.mission.strip()
    connection = get_db_connection()
    connection.execute(
        "UPDATE users SET mission = ? WHERE id = ?",
        (mission, current_user["id"]),
    )
    connection.commit()
    updated_user = connection.execute(
        "SELECT * FROM users WHERE id = ?",
        (current_user["id"],),
    ).fetchone()
    connection.close()
    return {"message": "Mission updated.", "user": serialize_user(updated_user)}


@app.post("/checkin")
def checkin(current_user: sqlite3.Row = Depends(parse_token)) -> dict:
    today = date.today()
    today_text = today.isoformat()
    last_active_text = current_user["last_active_date"]
    learned_today = get_today_learning_text(current_user["id"]).strip()

    if not learned_today:
        raise HTTPException(
            status_code=400,
            detail="Add what you learned today before marking the day as done.",
        )

    # Ignore repeated check-ins on the same day.
    if last_active_text == today_text:
        return {"message": "Already checked in today.", "user": serialize_user(current_user)}

    yesterday_text = (today - timedelta(days=1)).isoformat()
    current_streak = current_user["current_streak"]

    # Core streak rules:
    # - Continue if yesterday
    # - Start at 1 if brand new or after missing days
    if last_active_text == yesterday_text:
        current_streak += 1
    else:
        current_streak = 1

    longest_streak = max(current_streak, current_user["longest_streak"])

    connection = get_db_connection()
    connection.execute(
        """
        UPDATE users
        SET current_streak = ?, longest_streak = ?, last_active_date = ?
        WHERE id = ?
        """,
        (current_streak, longest_streak, today_text, current_user["id"]),
    )

    connection.execute(
        "INSERT OR IGNORE INTO checkins (user_id, date) VALUES (?, ?)",
        (current_user["id"], today_text),
    )
    connection.commit()

    updated_user = connection.execute(
        "SELECT * FROM users WHERE id = ?",
        (current_user["id"],),
    ).fetchone()
    connection.close()

    return {"message": "Check-in saved.", "user": serialize_user(updated_user)}


@app.put("/today-learning")
def update_today_learning(
    payload: LearningPayload,
    current_user: sqlite3.Row = Depends(parse_token),
) -> dict:
    learned_today = payload.learned_today.strip()
    today_text = date.today().isoformat()

    connection = get_db_connection()
    connection.execute(
        """
        INSERT INTO checkins (user_id, date, learned_today)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, date)
        DO UPDATE SET learned_today = excluded.learned_today
        """,
        (current_user["id"], today_text, learned_today),
    )
    connection.commit()
    updated_user = connection.execute(
        "SELECT * FROM users WHERE id = ?",
        (current_user["id"],),
    ).fetchone()
    connection.close()

    return {"message": "Today's learning saved.", "user": serialize_user(updated_user)}


@app.get("/learning-history")
def learning_history(current_user: sqlite3.Row = Depends(parse_token)) -> dict:
    return {
        "username": current_user["username"],
        "history": get_learning_history(current_user["id"]),
    }


@app.put("/learning-history/{entry_date}")
def update_learning_history_entry(
    entry_date: str,
    payload: LearningPayload,
    current_user: sqlite3.Row = Depends(parse_token),
) -> dict:
    normalized_date = validate_entry_date(entry_date)
    learned_today = payload.learned_today.strip()

    connection = get_db_connection()
    existing_entry = connection.execute(
        "SELECT id FROM checkins WHERE user_id = ? AND date = ?",
        (current_user["id"], normalized_date),
    ).fetchone()

    if not existing_entry:
        connection.close()
        raise HTTPException(status_code=404, detail="Learning entry not found.")

    connection.execute(
        """
        UPDATE checkins
        SET learned_today = ?
        WHERE user_id = ? AND date = ?
        """,
        (learned_today, current_user["id"], normalized_date),
    )
    connection.commit()
    updated_user = connection.execute(
        "SELECT * FROM users WHERE id = ?",
        (current_user["id"],),
    ).fetchone()
    connection.close()

    return {
        "message": "Learning entry updated.",
        "entry": {"date": normalized_date, "learned_today": learned_today},
        "user": serialize_user(updated_user),
        "history": get_learning_history(current_user["id"]),
    }


@app.get("/leaderboard")
def leaderboard(current_user: sqlite3.Row = Depends(parse_token)) -> dict:
    connection = get_db_connection()
    users = connection.execute(
        """
        SELECT DISTINCT users.username, users.current_streak, users.longest_streak, users.mission
        FROM users
        INNER JOIN checkins ON checkins.user_id = users.id
        ORDER BY current_streak DESC, longest_streak DESC, username ASC
        """
    ).fetchall()
    connection.close()

    return {
        "current_user": current_user["username"],
        "leaderboard": [dict(row) for row in users],
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
