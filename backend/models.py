"""
models.py — ta shapes twn requests kai responses, basically i "morfh" twn dedomenwn

to Pydantic elegxei automata ta incoming JSONs kai an kati den stamparei
epistrefei 422 prin ftasei sto diko mas kwdika — super convenient ngl
"""

from pydantic import BaseModel, Field, model_validator


# ── Request bodies ────────────────────────────────────────────────────────────

class NewMovie(BaseModel):
    """ayto stelnei o user otan thelei na prostethei neo tainía sti vasi"""
    title:  str = Field(..., min_length=1, description="Movie title")
    genres: str = Field(..., min_length=1, description="Pipe-separated genre list, e.g. Action|Drama")


class SessionRating(BaseModel):
    """ena zeugaraki (tainía, vathmologia) apo ton user gia ayti ti session"""
    movieId: int   = Field(..., gt=0)
    rating:  float = Field(..., ge=0.5, le=5.0)


class RecommendationRequest(BaseModel):
    """ayto stelnei o user otan thelei recommendations — lista me ta ratings tou"""
    ratings: list[SessionRating] = Field(..., min_length=1)

    @model_validator(mode="after")
    def no_duplicate_movie_ids(self) -> "RecommendationRequest":
        # an o user steilei to idio movieId dis, sto recommender to deutero
        # tha overwritarei to proto kai tha xasoume data silently — better to crash early
        ids = [r.movieId for r in self.ratings]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate movieIds in ratings list — each movie may appear only once")
        return self


# ── Response shapes ───────────────────────────────────────────────────────────

class MovieItem(BaseModel):
    """mia tainía opos epistrefetai apo to search"""
    movieId: int
    title:   str
    genres:  str


class RatingItem(BaseModel):
    """mia grammi rating apo ti vasi opos epistrefetai apo to /ratings/{movieId}"""
    userId:    int
    movieId:   int
    rating:    float
    timestamp: int


class RecommendedMovie(BaseModel):
    """mia provlepomeni tainia me to predicted rating tis
    isFallback = True simainei oti den vrikame arketa similar users kai
    epistrefoume ta globally popular movies anti gia personalized"""
    movieId:         int
    title:           str
    genres:          str
    predictedRating: float
    isFallback:      bool = False
