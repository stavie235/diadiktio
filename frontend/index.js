// ── Configuration ─────────────────────────────────────────────────────────
// BASE_URL is the ONLY thing you change when deploying to a different server.
const BASE_URL = "http://localhost:3000/movielens/api";

// ── Session state ─────────────────────────────────────────────────────────
// Plain JS object — NOT localStorage — so ratings disappear on page refresh.
// Keys are movieId (number), values are rating (number).
const sessionRatings = {};


// ── Utility helpers ────────────────────────────────────────────────────────

/** Show a message in a .msg element.  type is "ok" | "err" | "info". */
function setMsg(id, text, type = "info") {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `msg ${type}`;
}

/**
 * Extract an error message from an API response body.
 * After the backend fix all errors are {"status":"error","message":"..."};
 * data.detail is a fallback for unexpected FastAPI 500s that still use the
 * default {"detail": "..."} shape.
 */
function apiErr(data) {
  return data.message ?? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) ?? "Unknown error";
}

/** Clear a message element. */
function clearMsg(id) {
  const el = document.getElementById(id);
  el.textContent = "";
  el.className = "msg";
}

/** Re-render the session ratings list shown below the rating form. */
function renderSessionList() {
  const el = document.getElementById("session-list");
  const entries = Object.entries(sessionRatings);
  if (entries.length === 0) {
    el.textContent = "No ratings yet this session.";
    return;
  }
  el.textContent = "Session ratings: "
    + entries.map(([id, r]) => `Movie ${id} → ${r}`).join(" · ");
}


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
    // Network failure or JSON parse error.
    setMsg("msg-add", `Network error: ${err.message}`, "err");
  }
});


// ── Section 2: Search movies ───────────────────────────────────────────────

document.getElementById("btn-search").addEventListener("click", searchMovies);
// Allow pressing Enter in the search box to trigger search.
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
        <td>${escHtml(m.genres)}</td>
        <td>
          <button class="btn-use-id" data-id="${m.movieId}" style="font-size:.8rem;padding:.25rem .7rem">
            Use ID
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    table.style.display = "table";

    // "Use ID" fills the Movie ID fields in the Rate and Average sections.
    tbody.querySelectorAll(".btn-use-id").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        document.getElementById("rate-id").value = id;
        document.getElementById("avg-id").value  = id;
      });
    });

  } catch (err) {
    setMsg("msg-search", `Network error: ${err.message}`, "err");
  }
}


// ── Section 3: Rate a movie ────────────────────────────────────────────────

document.getElementById("btn-rate").addEventListener("click", async () => {
  const idVal  = document.getElementById("rate-id").value.trim();
  const rateVal = document.getElementById("rate-val").value.trim();
  clearMsg("msg-rate");

  const movieId = parseInt(idVal, 10);
  const rating  = parseFloat(rateVal);

  if (!idVal || isNaN(movieId) || movieId < 1) {
    setMsg("msg-rate", "Enter a valid Movie ID (positive integer).", "err");
    return;
  }
  if (!rateVal || isNaN(rating) || rating < 0.5 || rating > 5.0) {
    setMsg("msg-rate", "Rating must be between 0.5 and 5.0.", "err");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/ratings/${movieId}`);
    if (res.status === 404) {
      setMsg("msg-rate", `Movie ${movieId} does not exist in the database.`, "err");
      return;
    }
  } catch (err) {
    setMsg("msg-rate", `Network error: ${err.message}`, "err");
    return;
  }

  sessionRatings[movieId] = rating;
  setMsg("msg-rate", `Recorded: Movie ${movieId} → ${rating}`, "ok");
  renderSessionList();
});


// ── Section 4: Movie average rating ───────────────────────────────────────

document.getElementById("btn-avg").addEventListener("click", async () => {
  const idVal = document.getElementById("avg-id").value.trim();
  clearMsg("msg-avg");

  const movieId = parseInt(idVal, 10);
  if (!idVal || isNaN(movieId) || movieId < 1) {
    setMsg("msg-avg", "Enter a valid Movie ID.", "err");
    return;
  }

  try {
    const res  = await fetch(`${BASE_URL}/ratings/${movieId}`);
    const data = await res.json();

    if (res.status === 404) {
      setMsg("msg-avg", `Movie ${movieId} not found.`, "err");
      return;
    }
    if (!res.ok) {
      setMsg("msg-avg", `Error: ${apiErr(data)}`, "err");
      return;
    }

    const ratings = data.ratings;
    if (ratings.length === 0) {
      setMsg("msg-avg", "No ratings found for this movie.", "info");
      return;
    }

    // Compute average client-side from the returned ratings array.
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const avg = (sum / ratings.length).toFixed(2);
    setMsg("msg-avg", `Average rating: ${avg} (from ${ratings.length} rating(s))`, "ok");

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

  // Convert the sessionRatings object into the array shape the API expects.
  const payload = {
    ratings: entries.map(([id, r]) => ({ movieId: Number(id), rating: r })),
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


// ── XSS guard ─────────────────────────────────────────────────────────────
// Escape HTML special characters before injecting user-controlled strings
// into innerHTML.  Without this a movie title containing <script> would
// execute arbitrary code in the browser.
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// ── Initialise ────────────────────────────────────────────────────────────
renderSessionList();
