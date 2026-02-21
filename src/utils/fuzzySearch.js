/**
 * Fuzzy Search Utility
 * Handles spelling mistakes in search queries using Levenshtein distance algorithm
 * 
 * Example: "koththu" will match "kottu", "manue" will match "menu"
 */

/**
 * Calculate Levenshtein distance between two strings
 * This measures how many single-character edits are needed to change one word into another
 */
function levenshteinDistance(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 * 1 = exact match, 0 = completely different
 */
function similarityScore(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Check if search query matches target string with fuzzy matching
 * @param {string} searchQuery - What the user typed
 * @param {string} target - The actual text to match against
 * @param {number} threshold - Similarity threshold (0-1), default 0.6
 * @returns {boolean} - True if it's a fuzzy match
 */
export function fuzzyMatch(searchQuery, target, threshold = 0.6) {
  if (!searchQuery || !target) return false;
  
  const query = searchQuery.toLowerCase().trim();
  const text = target.toLowerCase().trim();
  
  // Exact match or substring match
  if (text.includes(query)) {
    return true;
  }
  
  // Check fuzzy match on whole string
  const score = similarityScore(query, text);
  if (score >= threshold) {
    return true;
  }
  
  // Check fuzzy match on individual words
  const targetWords = text.split(/\s+/);
  for (const word of targetWords) {
    const wordScore = similarityScore(query, word);
    if (wordScore >= threshold) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter and sort items by fuzzy search relevance
 * @param {Array} items - Array of items to search
 * @param {string} searchQuery - Search query
 * @param {Function} getSearchFields - Function that returns array of strings to search in each item
 * @param {number} threshold - Similarity threshold (0-1), default 0.6
 * @returns {Array} - Filtered and sorted items
 */
export function fuzzySearchFilter(items, searchQuery, getSearchFields, threshold = 0.6) {
  if (!searchQuery || !searchQuery.trim()) {
    return items;
  }
  
  const query = searchQuery.toLowerCase().trim();
  
  // Calculate relevance score for each item
  const itemsWithScores = items
    .map(item => {
      const searchFields = getSearchFields(item);
      let maxScore = 0;
      let hasExactMatch = false;
      
      for (const field of searchFields) {
        if (!field) continue;
        
        const text = field.toLowerCase();
        
        // Exact match or substring gets highest priority
        if (text.includes(query)) {
          hasExactMatch = true;
          maxScore = 1.0;
          break;
        }
        
        // Check fuzzy match on whole field
        const fieldScore = similarityScore(query, text);
        maxScore = Math.max(maxScore, fieldScore);
        
        // Check fuzzy match on individual words
        const words = text.split(/\s+/);
        for (const word of words) {
          const wordScore = similarityScore(query, word);
          maxScore = Math.max(maxScore, wordScore);
        }
      }
      
      return {
        item,
        score: maxScore,
        hasExactMatch
      };
    })
    .filter(({ score }) => score >= threshold);
  
  // Sort by: exact matches first, then by score
  itemsWithScores.sort((a, b) => {
    if (a.hasExactMatch && !b.hasExactMatch) return -1;
    if (!a.hasExactMatch && b.hasExactMatch) return 1;
    return b.score - a.score;
  });
  
  return itemsWithScores.map(({ item }) => item);
}

/**
 * Search restaurants with fuzzy matching
 * @param {Array} restaurants - Array of restaurant objects
 * @param {string} searchQuery - Search query
 * @returns {Array} - Filtered restaurants
 */
export function fuzzySearchRestaurants(restaurants, searchQuery) {
  return fuzzySearchFilter(
    restaurants,
    searchQuery,
    (restaurant) => [
      restaurant.restaurant_name,
      restaurant.cuisine,
      restaurant.description,
      restaurant.address,
    ],
    0.55 // Lower threshold for restaurants (more lenient)
  );
}

/**
 * Search foods with fuzzy matching
 * @param {Array} foods - Array of food objects
 * @param {string} searchQuery - Search query
 * @returns {Array} - Filtered foods
 */
export function fuzzySearchFoods(foods, searchQuery) {
  return fuzzySearchFilter(
    foods,
    searchQuery,
    (food) => [
      food.name,
      food.description,
      food.category,
      food?.restaurants?.restaurant_name,
    ],
    0.55 // Lower threshold for foods (more lenient)
  );
}
