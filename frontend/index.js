// ── Config ────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:3000/movielens/api";

// ── Session state ─────────────────────────────────────────────────────────
// {movieId: {rating, title}} — in-memory only, lost on refresh
const sessionRatings = {};

// Currently selected movies for the Rate and Average sections
let rateMovie = null; // {movieId, title}
let avgMovie  = null;


// ── Utility helpers ────────────────────────────────────────────────────────

function setMsg(id, text, type = "info") {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `msg ${type}`;
}

function apiErr(data) {
  return data.message ?? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) ?? "Unknown error";
}

function clearMsg(id) {
  const el = document.getElementById(id);
  el.textContent = "";
  el.className = "msg";
}

function renderSessionList() {
  const el = document.getElementById("session-list");
  const entries = Object.entries(sessionRatings);
  if (entries.length === 0) {
    el.textContent = "No ratings yet this session.";
    return;
  }
  el.textContent = "Session ratings: "
    + entries.map(([, { rating, title }]) => `${title} → ${rating}`).join(" · ");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// ── Inline movie search widget ─────────────────────────────────────────────
// Shared by the Rate and Average sections so the user picks a movie by title;
// the movieId is captured internally and never typed manually.

function makeMovieSearch({ searchId, btnId, resultsId, selectedId, onSelect }) {
  const searchInput = document.getElementById(searchId);
  const resultsEl   = document.getElementById(resultsId);
  const selectedEl  = document.getElementById(selectedId);

  async function doSearch() {
    const kw = searchInput.value.trim();
    resultsEl.innerHTML = "";
    resultsEl.style.display = "none";

    if (!kw) return;

    try {
      const res    = await fetch(`${BASE_URL}/movies?search=${encodeURIComponent(kw)}`);
      const data   = await res.json();
      const movies = data.movies ?? [];

      if (movies.length === 0) {
        const div = document.createElement("div");
        div.className = "result-item result-empty";
        div.textContent = "No movies found.";
        resultsEl.appendChild(div);
        resultsEl.style.display = "block";
        return;
      }

      movies.slice(0, 8).forEach((m) => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.textContent = `${m.title}  —  ${m.genres}`;
        div.addEventListener("click", () => {
          searchInput.value = m.title;
          selectedEl.textContent = `Selected: ${m.title}`;
          selectedEl.style.display = "block";
          resultsEl.style.display = "none";
          onSelect({ movieId: m.movieId, title: m.title });
        });
        resultsEl.appendChild(div);
      });

      resultsEl.style.display = "block";
    } catch (err) {
      // Network failure — user can retry
    }
  }

  document.getElementById(btnId).addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  // Clear selection whenever the user edits the search field
  searchInput.addEventListener("input", () => {
    onSelect(null);
    selectedEl.style.display = "none";
  });
}

makeMovieSearch({
  searchId:  "rate-search",
  btnId:     "btn-rate-find",
  resultsId: "rate-results",
  selectedId: "rate-selected",
  onSelect:  (m) => { rateMovie = m; },
});

makeMovieSearch({
  searchId:  "avg-search",
  btnId:     "btn-avg-find",
  resultsId: "avg-results",
  selectedId: "avg-selected",
  onSelect:  (m) => { avgMovie = m; },
});


// ── Section 1: Add a movie ─────────────────────────────────────────────────

document.getElementById("btn-add").addEventListener("click", async () => {
  const title  = document.getElementById("add-title").value.trim();
  const genres = document.getElementById("add-genres").value.trim();
  clearMsg("msg-add");

  if (!title || !genres) {
    setMsg("msg-add", "Please fill in both Title and Genres.", "err");
    return;
  }

  try {
    const res  = await fetch(`${BASE_URL}/movies`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title, genres }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMsg("msg-add", `Error: ${apiErr(data)}`, "err");
      return;
    }

    setMsg("msg-add", `Movie added successfully. New ID: ${data.movieId}`, "ok");
    document.getElementById("add-title").value  = "";
    document.getElementById("add-genres").value = "";
  } catch (err) {
    setMsg("msg-add", `Network error: ${err.message}`, "err");
  }
});


// ── Section 2: Search movies ───────────────────────────────────────────────

document.getElementById("btn-search").addEventListener("click", searchMovies);
document.getElementById("search-kw").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchMovies();
});

async function searchMovies() {
  const kw = document.getElementById("search-kw").value.trim();
  clearMsg("msg-search");

  try {
    const res  = await fetch(`${BASE_URL}/movies?search=${encodeURIComponent(kw)}`);
    const data = await res.json();

    if (!res.ok) {
      setMsg("msg-search", `Error: ${apiErr(data)}`, "err");
      return;
    }

    const movies = data.movies;
    const tbody  = document.getElementById("tbody-search");
    const table  = document.getElementById("tbl-search");
    tbody.innerHTML = "";

    if (movies.length === 0) {
      setMsg("msg-search", "No movies found.", "info");
      table.style.display = "none";
      return;
    }

    setMsg("msg-search", `${movies.length} result(s).`, "info");
    movies.forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.movieId}</td>
        <td>${escHtml(m.title)}</td>
        <td>${escHtml(m.genres)}</td>`;
      tbody.appendChild(tr);
    });

    table.style.display = "table";

  } catch (err) {
    setMsg("msg-search", `Network error: ${err.message}`, "err");
  }
}


// ── Section 3: Rate a movie ────────────────────────────────────────────────

document.getElementById("btn-rate").addEventListener("click", () => {
  const rateVal = document.getElementById("rate-val").value.trim();
  clearMsg("msg-rate");

  if (!rateMovie) {
    setMsg("msg-rate", "Search for and select a movie first.", "err");
    return;
  }

  const rating = parseFloat(rateVal);
  if (!rateVal || isNaN(rating) || rating < 0.5 || rating > 5.0) {
    setMsg("msg-rate", "Rating must be between 0.5 and 5.0.", "err");
    return;
  }

  const { movieId, title } = rateMovie;
  sessionRatings[movieId] = { rating, title };
  setMsg("msg-rate", `Recorded: "${title}" → ${rating}`, "ok");
  renderSessionList();
});


// ── Section 4: Movie average rating ───────────────────────────────────────

document.getElementById("btn-avg").addEventListener("click", async () => {
  clearMsg("msg-avg");

  if (!avgMovie) {
    setMsg("msg-avg", "Search for and select a movie first.", "err");
    return;
  }

  const { movieId, title } = avgMovie;

  try {
    const res  = await fetch(`${BASE_URL}/ratings/${movieId}`);
    const data = await res.json();

    if (res.status === 404) {
      setMsg("msg-avg", `Movie "${title}" not found.`, "err");
      return;
    }
    if (!res.ok) {
      setMsg("msg-avg", `Error: ${apiErr(data)}`, "err");
      return;
    }

    const ratings = data.ratings;
    if (ratings.length === 0) {
      setMsg("msg-avg", `No ratings found for "${title}".`, "info");
      return;
    }

    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const avg = (sum / ratings.length).toFixed(2);
    setMsg("msg-avg", `Average rating for "${title}": ${avg} (from ${ratings.length} rating(s))`, "ok");

  } catch (err) {
    setMsg("msg-avg", `Network error: ${err.message}`, "err");
  }
});


// ── Section 5: Recommendations ────────────────────────────────────────────

document.getElementById("btn-recs").addEventListener("click", async () => {
  clearMsg("msg-recs");
  const tbody = document.getElementById("tbody-recs");
  const table = document.getElementById("tbl-recs");

  const entries = Object.entries(sessionRatings);
  if (entries.length === 0) {
    setMsg("msg-recs", "Add at least one session rating before requesting recommendations.", "err");
    return;
  }

  // All ratings accumulated during the session are sent together.
  const payload = {
    ratings: entries.map(([id, { rating }]) => ({ movieId: Number(id), rating })),
  };

  try {
    setMsg("msg-recs", "Fetching recommendations …", "info");
    const res  = await fetch(`${BASE_URL}/recommendations`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setMsg("msg-recs", `Error: ${apiErr(data)}`, "err");
      return;
    }

    const recs = data.recommendations;
    tbody.innerHTML = "";

    if (recs.length === 0) {
      setMsg("msg-recs", "No recommendations found. Try rating more movies.", "info");
      table.style.display = "none";
      return;
    }

    const isFallback = recs.length > 0 && recs[0].isFallback;
    const label = isFallback
      ? `${recs.length} popular movie(s) shown — not enough overlap with other users for personalised recommendations.`
      : `${recs.length} personalised recommendation(s) returned.`;
    setMsg("msg-recs", label, isFallback ? "info" : "ok");

    recs.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.movieId}</td>
        <td>${escHtml(r.title)}</td>
        <td>${escHtml(r.genres)}</td>
        <td><strong>${r.predictedRating}</strong></td>`;
      tbody.appendChild(tr);
    });
    table.style.display = "table";

  } catch (err) {
    setMsg("msg-recs", `Network error: ${err.message}`, "err");
  }
});


// ── init ──────────────────────────────────────────────────────────────────
renderSessionList();
