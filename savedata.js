const supabase = require("./supabaseClient");
const crypto = require("crypto");

/* -------------------- Helpers -------------------- */

function normalizeLink(url = "") {
  if (!url) return "";
  return url
    .trim()
    .replace(/^http:\/\//, "https://")
    .replace(/^https:\/\/www\./, "https://")
    .replace(/\/+$/, "");
}

function hashObject(obj) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex");
}

function deduplicateByLink(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.link) continue;
    map.set(item.link, item); // last write wins
  }
  return Array.from(map.values());
}

/* -------------------- Core Save Function -------------------- */

async function saveMoviesToSupabase(moviesInput = []) {
  if (!Array.isArray(moviesInput) || !moviesInput.length) {
    console.log("ℹ️ No movies to save");
    return;
  }

  const batchSize = 200;
  let totalSaved = 0;

  // 1. Normalize + pre-clean
  const normalized = moviesInput
    .map(m => ({
      ...m,
      link: normalizeLink(m.link)
    }))
    .filter(m => m.link);

  // 2. Deduplicate AFTER normalization
  const movies = deduplicateByLink(normalized);

  for (let i = 0; i < movies.length; i += batchSize) {
    const chunk = movies.slice(i, i + batchSize);

    const payload = chunk.map(movie => {
      const canonical = {
        title: movie.title || "",
        link: movie.link,
        image: movie.image || "",
        narrator: movie.narrator || "",
        release_year: movie.release_year || null,
        downloads: movie.downloads || [],
        tmdb_id: movie.tmdb_id || null,
        tmdb_rating: movie.tmdb_rating || 0,
        popularity: movie.popularity || 0,
        type: movie.type || "movie",
        publishedAt: movie.publishedAt || null,
        modifiedAt: new Date().toISOString()
      };

      return {
        ...canonical,
        _hash: hashObject(canonical),
        score:0
      };
    });

    const { data, error } = await supabase
      .from("moviesv2")
      .upsert(payload, {
        onConflict: ["link"]
      })
      .select("link");

    if (error) {
      console.error(
        `❌ Batch ${Math.floor(i / batchSize) + 1} failed:`,
        error.message
      );
      continue;
    }

    totalSaved += data.length;
    console.log(`✅ Saved ${totalSaved}/${movies.length}`);
  }

  console.log(`🎉 Finished saving ${totalSaved} movies to Supabase`);
}

/* -------------------- Export -------------------- */

module.exports = { saveMoviesToSupabase };
