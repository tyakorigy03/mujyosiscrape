const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const { enrichWithTMDB } = require("./enrichWithTmdb");

const STORAGE_DIR = path.join(__dirname, "storage");
const MOVIES_FULL_FILE = path.join(STORAGE_DIR, "movies_full_data.json");
const SERIES_FULL_FILE = path.join(STORAGE_DIR, "series_full_data.json");

/* -------------------- Helpers -------------------- */

      //  helpers
      const narrators = [
          "B da great",
          "Cyber Bigwi",
          "Didier",
          "Dylan Kabaka",
          "Eric Pro",
          "Fey",
          "Fred",
          "Gaheza",
          "Hakim",
          "Jovi",
          "Junior Giti",
          "Kim Rwanda",
          "Master P",
          "Moses",
          "Mr Genius",
          "Ndabaga",
          "Nkuba",
          "Perfect",
          "PK",
          "Remmy",
          "Robert",
          "Rocky",
          "Saga Mwiza",
          "Sankara Da Premiere",
          "Savimbi",
          "Senior",
          "Sikov",
          "Vj Steppin",
          "Yakuza",
          "Yanga"
        ];

    // Function to get actual narrator name
    function getActualNarratorName(dummyName) {
      // Normalize input to ignore case and extra spaces
      const normalized = dummyName.trim().toLowerCase();

      // Find the first narrator that matches partially or fully
      const match = narrators.find(name => name.toLowerCase() === normalized);

      // Return matched name or original input if not found
      return match || dummyName;
    }

function extractYear(text = "") {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function cleanText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function normalize(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function hashObject(obj) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalize(obj)))
    .digest("hex");
}

async function loadCacheSafe(file) {
  try {
    if (!(await fs.pathExists(file))) return [];
    const data = await fs.readJson(file);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* -------------------- Core Scraper -------------------- */

async function scrapeFullData({
  list,
  browser,
  type, // "movie" | "tv"
  cacheFile
}) {
  await fs.ensureDir(STORAGE_DIR);

  const page = await browser.newPage();
  const cache = await loadCacheSafe(cacheFile);

  // Map by link for O(1)
  const cacheMap = new Map(cache.map(item => [item.link, item]));
  const updatedCache = [...cache];
  const output = [];

  for (const item of list) {
    try {
      await page.goto(item.url, {
        waitUntil: "networkidle2",
        timeout: 60000
      });

      const scraped = await page.evaluate(() => {



     function transformIsataLink(originalUrl, mode = "download") { 
        try {
          const url = new URL(originalUrl);

          // Match: https://isatafilez.my/files/...
          if (url.hostname === "isatafilez.my" && url.pathname.startsWith("/files/")) {
            const encodedPath = url.pathname.replace("/files/", "");
            const decodedPath = decodeURIComponent(encodedPath);

            if (!decodedPath) return originalUrl;

            // DOWNLOAD MODE → redirect-download edge function
            if (mode === "download") {
              // Use full path instead of just filename
              return `https://byelcaamxxvfltnegxby.supabase.co/functions/v1/redirect-download?filename=${encodeURIComponent(decodedPath)}`;
            }

            // WATCH MODE → direct CDN file
            if (mode === "watch") {
              return `https://files.isatafilez.my/${encodedPath}`;
            }
          }

          return originalUrl;
        } catch {
          // Invalid URL → return unchanged
          return originalUrl;
        }
      }

        const Downloadurls = [];

        document.querySelectorAll("ul li").forEach(li => {
          const title = li.querySelector("h5")?.textContent;
          const link = li.querySelector("a")?.href;
          if (title && link) {
            Downloadurls.push({
              title: title.trim(),
              watchUrl: transformIsataLink(link, "watch"),
              downloadUrl: transformIsataLink(link, "download")
            });
          }
        });
        if(Downloadurls.length==0){
           document.querySelectorAll(".episode-card .btn-download").forEach(btn => {
                const title = btn.closest(".episode-card").querySelector(".episode-title")?.textContent;
                const onclick = btn.getAttribute("onclick") || "";
                const match = onclick.match(/openInNewTab\(['"](.+?)['"]\)/);
                const link = match ? match[1] : null;
                if (title && link) {
                  Downloadurls.push({
                    title: title.trim(),
                     watchUrl: transformIsataLink(link, "watch"),
                     downloadUrl: transformIsataLink(link, "download")
                  });
                }
              });
        }

        return {
          narratorRaw: document.querySelector("h3")?.textContent || "",
          yearRaw: document.querySelector("p")?.textContent || "",
          Downloadurls
        };
      });

      const releaseYear = extractYear(scraped.yearRaw);

      const enriched = await enrichWithTMDB({
        title: item.title,
        publishedAt: releaseYear ? `01/01/${releaseYear}` : null,
        type
      });

      const fullData = {
        title: item.title,
        link: item.url,
        image: item.image,
        narrator: getActualNarratorName(cleanText(scraped.narratorRaw.split("by")[1] || "")) ,
        release_year: releaseYear,
        Downloadurls: scraped.Downloadurls,
        ...enriched,
        saved: false
      };

      const newHash = hashObject(fullData);
      const cached = cacheMap.get(item.url);

      // NEW ENTRY
      if (!cached) {
        output.push(fullData);
        updatedCache.push({
          ...fullData,
          _hash: newHash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log(`✔ new ${type}:`, item.title);
        continue;
      }

      // EXISTING → CHECK FULL DIFF
      if (cached._hash !== newHash) {
        output.push(fullData);

        Object.assign(cached, {
          ...fullData,
          _hash: newHash,
          updatedAt: new Date().toISOString()
        });

        console.log(`↺ updated ${type}:`, item.title);
      }

      // ELSE → unchanged → do nothing

    } catch (err) {
      console.error(`✖ failed ${type}:`, item.url);
      console.error(err.message);
    }
  }

  if (output.length) {
    await fs.writeJson(cacheFile, updatedCache, { spaces: 2 });
    console.log(`Stored ${output.length} changed ${type}(s)`);
  }

  await page.close();
  return output; // ✅ ONLY NEW OR CHANGED
}

/* -------------------- Public APIs -------------------- */

async function recent_movies_data(list, browser) {
  return scrapeFullData({
    list,
    browser,
    type: "movie",
    cacheFile: MOVIES_FULL_FILE
  });
}

async function recent_series_data(list, browser) {
  return scrapeFullData({
    list,
    browser,
    type: "tv",
    cacheFile: SERIES_FULL_FILE
  });
}




/* -------------------- Export -------------------- */

module.exports = {
  recent_movies_data,
  recent_series_data
};
