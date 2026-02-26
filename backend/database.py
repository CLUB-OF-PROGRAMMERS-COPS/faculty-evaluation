"""
database.py – SQLAlchemy engine & session factory.

Uses the Supabase Transaction-Mode connection string (port 6543 / PgBouncer).
Connection-pooling parameters are tuned for Render free-tier (60 concurrent users).
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:6543/postgres",
)

# ── Engine configuration ───────────────────────────────────
# pool_size   = max persistent connections kept open
# max_overflow = temporary extra connections beyond pool_size
# pool_pre_ping = detect stale connections before use (critical for PgBouncer)
# pool_recycle = close connections older than N seconds (avoid PgBouncer timeout)
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300,        # recycle every 5 min
    pool_timeout=30,         # wait up to 30 s for a connection
    connect_args={"options": "-c timezone=utc"},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency – yields a session then closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
