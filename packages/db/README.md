# @framerate/db

This package manages the database schema, migrations, and generated TypeScript types for the Framerate.cl project.

## Purpose
- **Single Source of Truth**: Contains the canonical database schema definitions via Supabase migrations.
- **Type Safety**: Exports generated TypeScript types from the database schema for use in `apps/web`, `apps/api`, and `apps/scraper`.
- **Management**: Provides scripts to manage local database development and migrations.
- **Storage Utilities**: Provides helpers for Supabase Storage bucket management.

## Usage

### Generating Types
To update the TypeScript definitions after a schema change:
```bash
bun run generate:types
```

### Creating a Migration
To create a new migration file:
```bash
bun run migration:new <migration_name>
```

### Resetting Local DB
To reset the local database and apply all migrations:
```bash
bun run db:reset
```

## Storage Buckets

The project uses Supabase Storage for managing images:

### `store-logos` Bucket
- **Purpose**: Store logos for each retailer
- **Naming Convention**: `{store_slug}.{ext}` (e.g., `sp-digital.png`)
- **Max File Size**: 1MB
- **Allowed Types**: PNG, JPEG, WebP, SVG

### `product-images` Bucket
- **Purpose**: Product images identified by MPN
- **Naming Convention**: `{mpn}.{ext}` (e.g., `RTX4090-GAMING-X-TRIO.webp`)
- **Max File Size**: 2MB
- **Allowed Types**: PNG, JPEG, WebP

### Storage Utilities

```typescript
import { 
  StorageBuckets,
  getStoreLogoPath,
  getProductImagePath,
  getStoragePublicUrl,
  getStoreLogoUrl,
  getProductImageUrl,
  isAllowedMimeType,
  isWithinSizeLimit,
} from "@framerate/db";

// Get file path for a store logo
const logoPath = getStoreLogoPath("sp-digital"); // "sp-digital.png"

// Get file path for a product image (using MPN)
const imagePath = getProductImagePath("RTX4090-GAMING-X-TRIO"); // "RTX4090-GAMING-X-TRIO.webp"

// Get public URL for a store logo
const logoUrl = getStoreLogoUrl(
  "https://abc123.supabase.co",
  "sp-digital"
);
// "https://abc123.supabase.co/storage/v1/object/public/store-logos/sp-digital.png"

// Get public URL for a product image
const productUrl = getProductImageUrl(
  "https://abc123.supabase.co",
  "RTX4090-GAMING-X-TRIO"
);
// "https://abc123.supabase.co/storage/v1/object/public/product-images/RTX4090-GAMING-X-TRIO.webp"

// Validate MIME type
isAllowedMimeType(StorageBuckets.STORE_LOGOS, "image/png"); // true
isAllowedMimeType(StorageBuckets.PRODUCT_IMAGES, "image/svg+xml"); // false

// Validate file size
isWithinSizeLimit(StorageBuckets.STORE_LOGOS, 500000); // true (500KB < 1MB)
```

### Why MPN for Product Images?

Using the Manufacturer Part Number (MPN) as the identifier for product images ensures:
1. **Deduplication**: The same product scraped from multiple stores shares one image
2. **Consistency**: All listings of the same product display the same image
3. **Efficiency**: No duplicate storage for the same product across stores
