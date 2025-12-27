function getRecencyBoost(publishedAt, maxBoost = 3, decayDays = 365) {
  const pubDate = new Date(publishedAt);
  const now = new Date();
  const daysOld = (now - pubDate) / (1000 * 60 * 60 * 24);

  if (isNaN(daysOld) || daysOld < 0 || daysOld >= decayDays) return 0;

  const boost = ((decayDays - daysOld) / decayDays) * maxBoost;
  return Math.round(boost * 10) / 10;
}

function computeRelevanceScore({
  tmdb_rating = 0,
  popularity = 0,
  publishedAt = '',
  modifiedAt = '',
  narrator = '',
  title = ''
}) {
  let score = 0;

  // 🎬 TMDB rating
  if (tmdb_rating) score += tmdb_rating * 3;

  // 🎤 Narrator rating
  const narratorRatings = require('../data/narratorRatings.json');
  const narrator_rating = narratorRatings[narrator?.toLowerCase()] || 0;
  score += narrator_rating * 2;

  // 🔥 Popularity (normalized)
  if (popularity) score += Math.min(popularity / 20, 5);

  // 📅 Robust recency boost
  score += getRecencyBoost(publishedAt);

  // 🔄 Update boost
  const modDate = new Date(modifiedAt);
  const now = new Date();
  const daysSinceUpdate = (now - modDate) / (1000 * 60 * 60 * 24);
  const keywords = ['part', 'episode', 'season', 'vol', 'volume'];
  const hasContinuationHint = keywords.some(k => title.toLowerCase().includes(k));

  let updateFactor = 0;
  if (!isNaN(daysSinceUpdate) && daysSinceUpdate < 10) updateFactor += 1;
  if (hasContinuationHint) updateFactor += 1;

  score += updateFactor;

  return Math.round(score * 10) / 10;
}

module.exports = { computeRelevanceScore };
