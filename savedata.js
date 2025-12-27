const supabase = require('./supabaseClient');
const { computeRelevanceScore } = require('./relevanceScore');

function deduplicateByLink(movies) {
  const map = new Map();
  for (const movie of movies) {
    if (movie.link) {
      map.set(movie.link, movie); // overwrites duplicates, keep last
    }
  }
  return Array.from(map.values());
}
function normalizeLink(url) {
  return url.replace(/^https?:\/\/(www\.)?/, 'https://');
}
async function saveMoviesToSupabase(moviesinput) {
  const filteredMovies = moviesinput
  let movies=filteredMovies;
  const batchSize = 200;
  let count = 0;
  for (let i = 0; i < movies.length; i += batchSize) {
    const chunk = movies.slice(i, i + batchSize);
    // Deduplicate chunk by link
    const uniqueChunk = deduplicateByLink(chunk);
    const toInsert = uniqueChunk.map(movie => {
      return {
        ...movie,
          link: normalizeLink(movie.link) || '',
          score: computeRelevanceScore({
          tmdb_rating: movie.tmdb_rating || 0,
          popularity: movie.popularity || 0,
          publishedAt: movie.publishedAt || '',
          modifiedAt: movie.modifiedAt || '',
          narrator: movie.narrator || '',
          title: movie.title || ''
        })
      };
    });
    const { error, data } = await supabase
      .from('moviesv2')
      .upsert(toInsert, { onConflict: ['link'] })
      .select();
    if (error) {
      console.error(`❌ Failed inserting batch ${i / batchSize + 1}:`, error);
      console.error(`Failed inserting batch ${i / batchSize + 1}: ${error.message}`);
    } else {
      count += data.length;
      console.log(`✅ Saved ${count} movies so far...`);
    }
  }
  console.log(`🎉 Finished saving ${count} movies to Supabase.`);
}
module.exports = { saveMoviesToSupabase };
