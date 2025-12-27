const puppeteer = require("puppeteer");

const { recentMovies, recentSeries } = require("./recent");
const {
  recent_movies_data,
  recent_series_data
} = require("./recent_step_1");
const { saveMoviesToSupabase } = require("./savedata");

async function scrapeAll() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    /* -------------------- MOVIES -------------------- */

    const moviesList = await recentMovies();
    const moviesWithData = await recent_movies_data(moviesList, browser);

    if (moviesWithData.length) {
      await saveMoviesToSupabase(
        moviesWithData.map(m => ({ ...m, type: "movie" }))
      );
    } else {
      console.log("ℹ️ No new or updated movies");
    }

    /* -------------------- SERIES -------------------- */

    const seriesList = await recentSeries();
    const seriesWithData = await recent_series_data(seriesList, browser);

    if (seriesWithData.length) {
      await saveMoviesToSupabase(
        seriesWithData.map(s => ({ ...s, type: "tv" }))
      );
    } else {
      console.log("ℹ️ No new or updated series");
    }

  } catch (err) {
    console.error("❌ Scrape failed:", err.message);
  } finally {
    await browser.close();
    console.log("✅ Browser closed");
  }
}

scrapeAll();
