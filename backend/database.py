"""
database.py — SQLite connection helper and low-level query utilities.

All other modules import `get_db()` to obtain a connection; they never call
sqlite3.connect() directly, so the DB path is configured in exactly one place.
"""

import sqlite3
from pathlib import Path

# Resolve path relative to this file so the server can be started from any CWD.
DB_PATH = Path(__file__).parent / "movielens.db"


def get_db() -> sqlite3.Connection:
    """
    Open and return a new SQLite connection with row_factory set to
    sqlite3.Row so columns can be accessed by name (row["title"]) as well
    as by index.  The caller is responsible for closing the connection.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row   # enables dict-like column access
    return conn


def fetchall(sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    """
    Run a SELECT query and return all rows.
    Params must be a tuple of values matching the ? placeholders in sql —
    never build the SQL string with format() or f-strings.
    """
    conn = get_db()
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def fetchone(sql: str, params: tuple = ()) -> sqlite3.Row | None:
    """Run a SELECT query and return the first row, or None if no rows match."""
    conn = get_db()
    try:
        return conn.execute(sql, params).fetchone()
    finally:
        conn.close()


def execute(sql: str, params: tuple = ()) -> int:
    """
    Run an INSERT/UPDATE/DELETE query and return the lastrowid.
    Commits automatically — each write is its own transaction, which is fine
    for this assignment's low-concurrency workload.
    """
    conn = get_db()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()
