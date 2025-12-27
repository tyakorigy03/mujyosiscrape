const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "storage");
const MOVIES_CACHE = path.join(STORAGE_DIR, "recent_movies.json");
const SERIES_CACHE = path.join(STORAGE_DIR, "recent_series.json");

/* -------------------- Helpers -------------------- */
async function loadCacheSafe(filePath) {
  try {
    if (!(await fs.pathExists(filePath))) {
      return [];
    }
    const data = await fs.readJson(filePath);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to read cache:", filePath);
    return [];
  }
}

function isSameData(oldData, newData) {
  return JSON.stringify(oldData) === JSON.stringify(newData);
}

async function scrapePage(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  const result = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".card"))
      .map(card => {
        const title = card.querySelector(".card-body h6")?.textContent.trim();
        const image = card.querySelector("img")?.src;
        const url = card.querySelector(".card-body a")?.href;

        if (!title || !image || !url) return null;
        return { title, image, url };
      })
      .filter(Boolean);
  });

  await browser.close();
  return result;
}

/* -------------------- Scrapers -------------------- */

async function recentMovies() {
  await fs.ensureDir(STORAGE_DIR);

  const scraped = await scrapePage("https://mujyosi.store/movies");
  console.log("Found", scraped.length, "movies");

  const previous = await loadCacheSafe(MOVIES_CACHE);

  if (previous.length && isSameData(previous, scraped)) {
    console.log("Movies unchanged");
    return [];
  }

  await fs.writeJson(MOVIES_CACHE, scraped, { spaces: 2 });
  console.log("Movies cache updated");

  return scraped;
}

async function recentSeries() {
  await fs.ensureDir(STORAGE_DIR);

  const scraped = await scrapePage("https://mujyosi.store/series");
  console.log("Found", scraped.length, "series");

  const previous = await loadCacheSafe(SERIES_CACHE);

  if (previous.length && isSameData(previous, scraped)) {
    console.log("Series unchanged");
    return [];
  }

  await fs.writeJson(SERIES_CACHE, scraped, { spaces: 2 });
  console.log("Series cache updated");

  return scraped;
}

/* -------------------- Runner -------------------- */

if (require.main === module) {
  (async () => {
    const movies = await recentMovies();
    const series = await recentSeries();

    console.log("Returned movies:", movies.length);
    console.log("Returned series:", series.length);
  })();
}

module.exports = {
  recentMovies,
  recentSeries
};
