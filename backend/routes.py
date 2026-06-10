"""
routes.py — The four API endpoints wired to an APIRouter.

The router is imported and mounted in main.py with the /movielens/api prefix.
Keeping routes separate from the app setup means you can add a second router
(e.g. /admin) in main.py without touching this file.
"""

from fastapi import APIRouter, HTTPException
from database import fetchall, fetchone, execute, get_db
from models import (
    NewMovie,
    RecommendationRequest,
    MovieItem,
    RatingItem,
    RecommendedMovie,
)
from recommender import recommend

router = APIRouter()


# ── 1. Search movies ──────────────────────────────────────────────────────────

@router.get("/movies")
def search_movies(search: str = ""):
    """
    GET /movielens/api/movies?search=<keyword>

    Case-insensitive substring match on title using SQLite's LIKE operator.
    LIKE is case-insensitive for ASCII by default in SQLite.
    Returns all movies when search is empty.

    Response: {"status": "success", "movies": [...]}
    """
    # % wildcards on both sides = 'contains' match, not 'starts with'.
    pattern = f"%{search}%"
    rows = fetchall(
        "SELECT movieId, title, genres FROM movies WHERE title LIKE ?",
        (pattern,),
    )
    movies = [MovieItem(movieId=r["movieId"], title=r["title"], genres=r["genres"])
              for r in rows]
    return {"status": "success", "movies": [m.model_dump() for m in movies]}


# ── 2. Get ratings for a movie ────────────────────────────────────────────────

@router.get("/ratings/{movieId}")
def get_ratings(movieId: int):
    """
    GET /movielens/api/ratings/{movieId}

    Returns every rating row for the given movie.
    404 if the movieId does not exist in the movies table.

    Response: {"status": "success", "ratings": [...]}
    """
    # First confirm the movie exists so we can return a meaningful 404.
    movie = fetchone("SELECT movieId FROM movies WHERE movieId = ?", (movieId,))
    if movie is None:
        raise HTTPException(status_code=404, detail={"status": "error", "message": f"Movie {movieId} not found"})

    rows = fetchall(
        "SELECT userId, movieId, rating, timestamp FROM ratings WHERE movieId = ?",
        (movieId,),
    )
    ratings = [RatingItem(userId=r["userId"], movieId=r["movieId"],
                          rating=r["rating"], timestamp=r["timestamp"])
               for r in rows]
    return {"status": "success", "ratings": [rt.model_dump() for rt in ratings]}


# ── 3. Add a movie ────────────────────────────────────────────────────────────

@router.post("/movies", status_code=201)
def add_movie(body: NewMovie):
    """
    POST /movielens/api/movies
    Body: {"title": "...", "genres": "Action|Drama"}

    Assigns a new movieId = max(movieId) + 1 so IDs never collide with
    the existing dataset.  The genres string follows the pipe-separated
    convention used throughout the CSV (e.g. "Action|Drama|Thriller").

    Response: {"status": "success", "movieId": <new_id>}
    """
    # Compute the next available ID inside the same connection to avoid a
    # race condition (though SQLite's write lock makes this safe in practice).
    conn = get_db()
    try:
        row = conn.execute("SELECT MAX(movieId) AS max_id FROM movies").fetchone()
        new_id = (row["max_id"] or 0) + 1
        conn.execute(
            "INSERT INTO movies (movieId, title, genres) VALUES (?, ?, ?)",
            (new_id, body.title, body.genres),
        )
        conn.commit()
    finally:
        conn.close()

    return {"status": "success", "movieId": new_id}


# ── 4. Get recommendations ────────────────────────────────────────────────────

@router.post("/recommendations")
def get_recommendations(body: RecommendationRequest):
    """
    POST /movielens/api/recommendations
    Body: {"ratings": [{"movieId": 1, "rating": 4.5}, ...]}

    Runs user-based collaborative filtering (see recommender.py).
    The submitted ratings are used only in memory for this request — they
    are NOT written to the database.

    Response: {"status": "success", "recommendations": [...]}
    """
    # Convert Pydantic objects to plain dicts for the pure-Python recommender.
    user_ratings = [{"movieId": r.movieId, "rating": r.rating}
                    for r in body.ratings]

    results = recommend(user_ratings)
    recs = [
        RecommendedMovie(
            movieId=r["movieId"],
            title=r["title"],
            genres=r["genres"],
            predictedRating=r["predictedRating"],
        )
        for r in results
    ]
    return {"status": "success", "recommendations": [r.model_dump() for r in recs]}
