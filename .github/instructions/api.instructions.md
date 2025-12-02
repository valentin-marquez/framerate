---
applyTo: "apps/api/**"
---
# Framerate.cl - API Gateway Guidelines

## Tech Stack
- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **Storage:** Cloudflare KV (Caching)

## Architecture Principles
- **Role:** Acts as the API Gateway and Caching Layer.
- **Read-Only DB:** Access Supabase using the `anon` key with Row Level Security (RLS).
- **No Write Access:** The API should generally NOT write to the database (writes are handled by the scraper).

## Caching Strategy
- **Cloudflare KV:** Use KV for caching responses.
- **TTLs:**
  - Product Listings: ~5 minutes
  - Product Details: ~15 minutes
  - Popular Searches: ~1 minute

## Security
- **Rate Limiting:** Implement rate limiting per IP.
- **Validation:** Validate all incoming requests.
- **Sanitization:** Ensure inputs are sanitized before processing.
