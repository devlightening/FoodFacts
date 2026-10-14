# FoodFacts

<p>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white">
  <img alt="Node" src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white">
</p>

**Scan a barcode, understand the food.** FoodFacts is a mobile food companion for Türkiye: it resolves a product from several sources, merges what they know, and turns the result into plain-language analysis cards (palm oil, sugar, allergens, additives, diet fit, Nutri-Score, NOVA).

Turkish products are poorly covered by any single database, so FoodFacts treats data coverage as the main problem and builds a small *source-merging* backend around it.

## How it works

```text
Expo app (camera barcode scan)
        │  GET /api/products/scan/:barcode
        ▼
Express backend
  validate barcode ─► SQLite cache (14-day TTL) ─► hit? return
        │ miss
        ▼
  Primary source: Open Food Facts
  Enrichment sources: Carrefour · Migros · Trendyol · Hepsiburada · Getir
        │
        ▼
  ProductMergeService ─► completeness score
        ▼
  ProductAnalysisService ─► analysis cards
```

| Part | What it does |
|---|---|
| `ProductResolverService` | Validates the barcode, checks the cache, queries sources through a common `ProductSourceAdapter` interface |
| `ProductMergeService` | Combines results from different sources into one product and scores how complete the data is |
| `ProductAnalysisService` | Builds the cards: data completeness, palm oil, sugar, allergens, additives, diet, Nutri-Score, NOVA, ingredients |
| `utils/` | Text normalization (Turkish aware), ingredient and nutrition parsing, allergen, additive and palm-oil detection |
| `CacheService` | Local SQLite cache using Node's built-in `node:sqlite` |

When data is thin, the app says so (low completeness) instead of guessing, and suggests an ingredients photo.

## Run it

```bash
npm install
npm --prefix backend install

npm run backend        # API on http://localhost:3001  (GET /api/health)
npm run start          # Expo dev server for the mobile app
```

The mobile app needs to reach the backend, so on a physical device use your computer's LAN address instead of `localhost`.

## Stack

React Native 0.81 · Expo SDK 54 · expo-camera · TypeScript — Express · cheerio · node:sqlite

## Known limits

- Early-stage project: no automated tests yet.
- Retailer adapters read public product pages, which can change without notice. Check each site's terms before using them beyond personal experiments.
- Analysis is informational and is not medical or dietary advice.

## Author

**Halil İbrahim Yıldırım** — .NET backend developer · [GitHub](https://github.com/devlightening) · [LinkedIn](https://www.linkedin.com/in/0001myprofile)
