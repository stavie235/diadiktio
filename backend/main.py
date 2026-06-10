"""
main.py — FastAPI application factory, CORS setup, and Uvicorn entry point.

Start the server:
    python main.py
        or
    uvicorn main:app --port 3000 --reload
"""

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from routes import router

app = FastAPI(
    title="MovieLens API",
    description="Collaborative-filtering recommendation service backed by MovieLens latest-small.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allowing all origins is convenient for local development and acceptable for
# a university assignment.  In production you would restrict allow_origins to
# the exact frontend domain (e.g. ["https://myapp.example.com"]).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Error handlers ────────────────────────────────────────────────────────────
# By default FastAPI wraps all errors as {"detail": ...}.  These handlers
# normalise every failure to {"status": "error", "message": "..."} so the
# frontend always sees the same shape — important for the JS try/catch logic.

@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # exc.detail is already our dict when raised by routes.py; a plain string
    # for FastAPI's own 404s (unknown paths) or 405s (wrong method).
    if isinstance(exc.detail, dict) and "message" in exc.detail:
        content = exc.detail
    else:
        content = {"status": "error", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Pydantic rejects bad request bodies before our code runs.  Turn the list
    # of Pydantic error dicts into a single readable sentence.
    first = exc.errors()[0]
    # Drop "body" prefix from location so "body → ratings → 0 → rating" becomes
    # "ratings → 0 → rating", which is easier to read in the UI.
    loc   = " → ".join(str(p) for p in first["loc"] if p != "body")
    # Pydantic prefixes model_validator errors with "Value error, " — strip it.
    raw   = first["msg"].removeprefix("Value error, ")
    msg   = f"{loc}: {raw}" if loc else raw
    return JSONResponse(status_code=422, content={"status": "error", "message": msg})


# ── Router ────────────────────────────────────────────────────────────────────
# All endpoints defined in routes.py are reachable under /movielens/api.
# Adding a prefix here means routes.py never needs to repeat it.
app.include_router(router, prefix="/movielens/api")


@app.get("/")
def root():
    """Health-check / sanity endpoint — visit http://localhost:3000/ to confirm the server is up."""
    return {"status": "ok", "message": "MovieLens API is running. See /docs for the interactive spec."}


if __name__ == "__main__":
    # Running `python main.py` starts Uvicorn directly.
    # --reload is omitted here; add it manually during development if you want
    # auto-restart on file changes: uvicorn main:app --port 3000 --reload
    uvicorn.run("main:app", host="0.0.0.0", port=3000)
