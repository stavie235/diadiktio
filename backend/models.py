"""
models.py — Pydantic request/response models.

Pydantic validates incoming JSON automatically when these types are used as
FastAPI parameter annotations.  Any field type mismatch returns a 422 error
before our code even runs.
"""

from pydantic import BaseModel, Field, model_validator


# ── Request bodies ────────────────────────────────────────────────────────────

class NewMovie(BaseModel):
    """Body for POST /movies."""
    title:  str = Field(..., min_length=1, description="Movie title")
    genres: str = Field(..., min_length=1, description="Pipe-separated genre list, e.g. Action|Drama")


class SessionRating(BaseModel):
    """A single (movie, rating) pair supplied by the user for this session."""
    movieId: int   = Field(..., gt=0)
    rating:  float = Field(..., ge=0.5, le=5.0)


class RecommendationRequest(BaseModel):
    """Body for POST /recommendations."""
    ratings: list[SessionRating] = Field(..., min_length=1)

    @model_validator(mode="after")
    def no_duplicate_movie_ids(self) -> "RecommendationRequest":
        # Duplicate IDs would silently overwrite each other in the recommender's
        # user_map dict; reject them explicitly so the caller gets a clear error.
        ids = [r.movieId for r in self.ratings]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate movieIds in ratings list — each movie may appear only once")
        return self


# ── Response shapes ───────────────────────────────────────────────────────────

class MovieItem(BaseModel):
    """A single movie as returned by search or recommendation responses."""
    movieId: int
    title:   str
    genres:  str


class RatingItem(BaseModel):
    """A single rating row as returned by /ratings/{movieId}."""
    userId:    int
    movieId:   int
    rating:    float
    timestamp: int


class RecommendedMovie(BaseModel):
    """A recommended movie with its predicted rating."""
    movieId:         int
    title:           str
    genres:          str
    predictedRating: float
    isFallback:      bool = False
