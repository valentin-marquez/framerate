-- 1. Identify Products with Missing Critical Fields (Specs)
-- These products might need re-crawling or manual review.
SELECT 
    id, 
    mpn, 
    name, 
    category_id, 
    created_at 
FROM products 
WHERE specs IS NULL OR specs = '{}'::jsonb;

-- 2. Identify Outdated Listings (Not updated in 3 days)
-- These listings might show stale price/stock data.
SELECT 
    id, 
    url, 
    price_cash, 
    last_updated 
FROM listings 
WHERE last_updated < NOW() - INTERVAL '3 days' 
AND is_active = true;

-- 3. Identify Potential Duplicates by Name (Fuzzy Match)
-- This finds products with very similar names in the same category.
SELECT 
    p1.id as id1, 
    p1.name as name1, 
    p2.id as id2, 
    p2.name as name2, 
    similarity(p1.name, p2.name) as sim
FROM products p1
JOIN products p2 ON p1.id < p2.id 
    AND p1.category_id = p2.category_id
WHERE similarity(p1.name, p2.name) > 0.9
ORDER BY sim DESC
LIMIT 50;

-- 4. Identify Products with Ambiguous MPN
-- MPN should be unique per brand usually, but here we check for multiple products sharing MPN
SELECT 
    mpn, 
    COUNT(*) as count, 
    array_agg(id) as ids 
FROM products 
WHERE mpn IS NOT NULL AND mpn != '' 
GROUP BY mpn 
HAVING COUNT(*) > 1;

-- 5. Identify Listings with Zero Price but Active
-- Likely errors in crawling
SELECT 
    id, 
    url, 
    price_cash, 
    is_active 
FROM listings 
WHERE price_cash = 0 AND is_active = true;
