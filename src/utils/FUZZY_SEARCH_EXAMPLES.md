# Fuzzy Search Implementation

## Overview
Fuzzy search helps customers find food items even when they make spelling mistakes. This is especially useful for regional cuisine names where spelling can vary.

## How It Works
The fuzzy search uses **Levenshtein Distance** algorithm which calculates how many single-character edits (insertions, deletions, substitutions) are needed to change one word into another.

## Examples

### Food Search Examples
| Customer Types | Actual Food Name | Will Match? |
|---------------|------------------|-------------|
| **koththu** | Kottu | ✅ Yes |
| **kotthu** | Kottu | ✅ Yes |
| **kothu** | Kottu | ✅ Yes |
| **biriany** | Biryani | ✅ Yes |
| **biriyani** | Biryani | ✅ Yes |
| **bryani** | Biryani | ✅ Yes |
| **parota** | Parotta | ✅ Yes |
| **parotha** | Parotta | ✅ Yes |
| **parata** | Parotta | ✅ Yes |
| **freid rice** | Fried Rice | ✅ Yes |
| **fride rice** | Fried Rice | ✅ Yes |
| **dosa** | Dosai | ✅ Yes |
| **dosay** | Dosai | ✅ Yes |

### Restaurant Search Examples
| Customer Types | Actual Restaurant | Will Match? |
|---------------|-------------------|-------------|
| **paradise** | Paradise Biryani | ✅ Yes |
| **paradice** | Paradise Biryani | ✅ Yes |
| **saravana** | Saravana Bhavan | ✅ Yes |
| **sarvana** | Saravana Bhavan | ✅ Yes |

## Features

### 1. **Smart Matching**
- Exact matches get highest priority
- Close spelling variations are accepted
- Word-by-word matching for multi-word items

### 2. **Configurable Threshold**
- Default threshold: 0.55 (55% similarity required)
- Lower threshold = more lenient matching
- Higher threshold = stricter matching

### 3. **Relevance Sorting**
- Exact matches appear first
- Then sorted by similarity score (best matches first)

## Implementation Details

### In HomeScreen
- Searches across: Food name, description, category, restaurant name
- Real-time filtering with 300ms debounce
- Client-side search for instant results

### In RestaurantFoodsScreen
- Searches within specific restaurant's menu
- Includes search bar with clear button
- Helps find items quickly in large menus

## Technical Details

### Algorithm
```javascript
// Levenshtein Distance calculation
function levenshteinDistance(str1, str2) {
  // Calculates minimum edits needed
  // Example: "kottu" -> "koththu" = 2 edits
}

// Similarity Score (0 to 1)
function similarityScore(str1, str2) {
  // 1.0 = exact match
  // 0.75 = 75% similar
  // 0.5 = 50% similar
}
```

### Usage
```javascript
import { fuzzySearchFoods, fuzzySearchRestaurants } from './utils/fuzzySearch';

// Search foods
const results = fuzzySearchFoods(allFoods, "koththu");
// Returns all foods matching "kottu" even with spelling variation

// Search restaurants  
const results = fuzzySearchRestaurants(allRestaurants, "paradice");
// Returns "Paradise" restaurant
```

## Performance
- ✅ Fast client-side search
- ✅ No API calls needed for each search
- ✅ Debounced to reduce calculations
- ✅ Works offline with cached data

## Benefits
1. **Better User Experience**: Customers don't need exact spelling
2. **Regional Language Support**: Handles transliteration variations
3. **Typo Tolerance**: Common typing mistakes are handled
4. **Faster Discovery**: Find items quickly without perfect spelling
