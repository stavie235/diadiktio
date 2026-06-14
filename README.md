# MovieLens Web Application

User-based collaborative filtering recommender service built with FastAPI + vanilla JS.

---

## Quick start

```bash
# 1. Install dependencies
python3 -m pip install -r requirements.txt

# 2. Populate the database (creates movielens.db from the bundled zip)
python3 init_db.py

# 3. Start the backend server
python3 main.py
```

The API is now live at **http://localhost:3000**.
Interactive docs (Swagger UI): **http://localhost:3000/docs**

**In a second terminal**, serve the frontend:

```bash
cd ../frontend
python3 -m http.server 8081
```

Then open **http://localhost:8081** in your browser.

> Do not open `index.html` directly as a `file://` URL — browsers block `fetch` requests from file URLs to localhost. Always serve it through the HTTP server above.
> Port 8080 is reserved by VS Code; use 8081 (or any other free port).

---

## Project layout

```
backend/
  main.py          # App factory, CORS, router mount, Uvicorn entry point
  database.py      # SQLite connection helper
  models.py        # Pydantic request/response models
  routes.py        # 4 API endpoints (APIRouter)
  recommender.py   # Pearson collaborative filtering, fully isolated
  init_db.py       # One-time DB population script
  requirements.txt
  README.md        ← you are here
frontend/
  index.html       # Markup (no framework)
  index.js         # All JS by feature block (fetch + async/await)
  index.css        # Clean layout, no external libs
```

---

## curl examples

```bash
# Search movies
curl "http://localhost:3000/movielens/api/movies?search=matrix"

# Get ratings for a movie
curl "http://localhost:3000/movielens/api/ratings/2571"

# Add a movie
curl -X POST http://localhost:3000/movielens/api/movies \
  -H "Content-Type: application/json" \
  -d '{"title": "My Movie (2025)", "genres": "Drama|Thriller"}'

# Get recommendations (send your session ratings in the body)
curl -X POST http://localhost:3000/movielens/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"ratings": [{"movieId": 1, "rating": 5.0}, {"movieId": 2571, "rating": 4.5}]}'
```

---
