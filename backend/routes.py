"""
routes.py — ta tessera endpoints tou app, ola edo

o router importaretai sto main.py me prefix /movielens/api opote den
xreiazetai na to epanalamvanoume se kathe route. an theleis na prostheseis
p.x. /admin endpoints apla kaneis neo router sto main.py kai den aggizetai ayto
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
    psaxnei me LIKE sto title, case-insensitive.
    an to search einai keno epistrefei oles tis tainies (careful me pagination lol)
    """
    # ta % kai stis duo meries = "contains" match, oxi "starts with"
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
    epistrefei ola ta ratings pou exei i tainía sti vasi.
    404 an to movieId den yparxei katholou
    """
    # elegxoume prwta an yparxei i tainía, alliws to 404 einai meaningless
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
    prosthetei neo movie sti vasi me neo ID = MAX + 1
    ta MovieLens IDs den einai sequential opote den kanoume auto-increment,
    apla pairnoume to megalytero ID kai prosthetoume 1 — safe lol
    """
    # to kanoume mesa sto idio connection gia na min yparksei race condition
    # (SQLite write lock to prostateei enwn alla still good practice)
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
    trexei ton recommender me ta session ratings tou user.
    ta ratings DEN grafontwi sti vasi, xrhsimopoiountai mono gia tin provlepsi
    """
    # elegxoume an ola ta movieIds yparxoun sti vasi — an oxi 422 me lista twn missing
    submitted_ids = [r.movieId for r in body.ratings]
    placeholders = ",".join("?" * len(submitted_ids))
    found = fetchall(
        f"SELECT movieId FROM movies WHERE movieId IN ({placeholders})",
        tuple(submitted_ids),
    )
    found_ids = {row["movieId"] for row in found}
    missing = [mid for mid in submitted_ids if mid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"status": "error", "message": f"Unknown movieId(s): {missing}"},
        )

    # ta Pydantic objects ta kanome plain dicts giati o recommender den xerei Pydantic
    user_ratings = [{"movieId": r.movieId, "rating": r.rating}
                    for r in body.ratings]

    results, is_fallback = recommend(user_ratings)
    recs = [
        RecommendedMovie(
            movieId=r["movieId"],
            title=r["title"],
            genres=r["genres"],
            predictedRating=r["predictedRating"],
            isFallback=is_fallback,
        )
        for r in results
    ]
    return {"status": "success", "recommendations": [r.model_dump() for r in recs]}
