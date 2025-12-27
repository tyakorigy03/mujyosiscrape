const axios = require('axios');
const Fuse = require('fuse.js');
require('dotenv').config();

const TMDB_API_KEY = process.env.TMDB_API_KEY || '97b73a4d4fcb7b36fbb151aac0f762d3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function normalizeTitle(title = ''){
  return title
    .replace(/&#8217;|&#8216;|&#8211;|&amp;/g, "'")                  // Convert HTML entities
    .replace(/\bS\d{1,2}(?:\s*E\d{1,2})?\b/gi, '')                 // Remove S01, S01E02, etc.
    .replace(/\bSeason\s*\d+\b/gi, '')                             // Remove 'Season 01'
    .replace(/\bPt\.?\s*\d+\b/gi, '')                              // Remove 'Pt.1', 'Pt2'
    .replace(/\bEpisode\s*\d+\b/gi, '')                            // Remove 'Episode 1'
    .replace(/\s*[\[\(][^\]\)]*[\]\)]/g, '')                       // Remove (2025), [Part 1]
    .replace(/[^a-zA-Z0-9\s:,'\-]/g, '')                           // Remove weird symbols
    .replace(/\b(Final|Film(?:s)?\s*\d*)\b/gi, '')                 // Remove 'Final', 'Films 10'
    .replace(/\b\d+[A-Za-z]?\b$/g, '')                             // Remove trailing "2", "3B"
    .replace(/\s{2,}/g, ' ')                                       // Collapse multiple spaces
    .trim()
    .replace(/^[\s\-:]+|[\s\-:]+$/g, '')                           // Trim leading/trailing punct
    .replace(/\s+([:,'\-])/g, '$1')                                // Fix space before punctuation
    .replace(/([:,'\-])\s+/g, '$1 ')                               // Fix space after punctuation
    .replace(/\s+/g, ' ')                                          // Normalize spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function searchTMDB({ query, year, type = 'movie' }) {
  const url = `https://api.themoviedb.org/3/search/${type}`;
  const params = {
    api_key: TMDB_API_KEY,
    query,
    include_adult: true,
    language: 'en-US',
    ...(year && type === 'movie' ? { year } : {}) // year only applies for movies
  };

  const response = await axios.get(url, { params });
  return response.data.results || [];
}

async function getDetailsFromTMDB(id, type) {
  const url = `https://api.themoviedb.org/3/${type}/${id}`;
  const response = await axios.get(url, {
    params: {
      api_key: TMDB_API_KEY,
      append_to_response: 'color',
    }
  });
  return response.data;
}

async function enrichWithTMDB({ title, publishedAt, type = 'movie' }) {
  if (!title || !TMDB_API_KEY || !['movie', 'tv'].includes(type)) {
    console.log('❌ Missing or invalid parameters:', { title, TMDB_API_KEY, type });
    return {};
  }

  try {
    const query = normalizeTitle(title);
    const year = publishedAt ? new Date(publishedAt).getFullYear() : undefined;

    const results = await searchTMDB({ query, year, type });

    if (results.length === 0) {
      console.log('⚠️ No results found for:', title);
      return {};
    }

    const fuse = new Fuse(results, {
      keys: ['title', 'name'],
      threshold: 0.4
    });

    const fuseResult = fuse.search(title);
    const bestMatch = fuseResult.length > 0 ? fuseResult[0].item : results[0];
    const tmdbId = bestMatch.id;

    const details = await getDetailsFromTMDB(tmdbId, type);

    const posterPath = details.poster_path;
    const backdropPath = details.backdrop_path;

    return {
      tmdb_id: details.id,
      tmdb_rating: details.vote_average,
      popularity: details.popularity,
      tmdb_overview: details.overview,
      tmdb_type: type,
      tmdb_title: details.title || details.name,
      tmdb_year: (details.release_date || details.first_air_date)
                   ? new Date(details.release_date || details.first_air_date).getFullYear()
                   : undefined,
      
      // Poster sizes
      poster_small: posterPath ? `${TMDB_IMAGE_BASE}/w185${posterPath}` : null,
      poster_medium: posterPath ? `${TMDB_IMAGE_BASE}/w342${posterPath}` : null,
      poster_large: posterPath ? `${TMDB_IMAGE_BASE}/w500${posterPath}` : null,
      poster: posterPath ? `${TMDB_IMAGE_BASE}/original${posterPath}` : null,

      // Backdrop sizes
      backdrop_small: backdropPath ? `${TMDB_IMAGE_BASE}/w300${backdropPath}` : null,
      backdrop_medium: backdropPath ? `${TMDB_IMAGE_BASE}/w780${backdropPath}` : null,
      backdrop_large: backdropPath ? `${TMDB_IMAGE_BASE}/w1280${backdropPath}` : null,
      backdrop: backdropPath ? `${TMDB_IMAGE_BASE}/original${backdropPath}` : null,

      color: details.color?.primary || null
    };

  } catch (err) {
    console.error('❌ TMDB enrichment failed:', err.message);
    return {};
  }
}

module.exports = { enrichWithTMDB };
