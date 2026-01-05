-- Fix listings prices to have default 0 and not null
-- This ensures that price calculations don't fail with null values

-- Update existing null values to 0
UPDATE listings SET price_normal = 0 WHERE price_normal IS NULL;
UPDATE listings SET price_cash = 0 WHERE price_cash IS NULL;

-- Alter table to set default 0 and not null constraint
ALTER TABLE listings 
  ALTER COLUMN price_normal SET DEFAULT 0,
  ALTER COLUMN price_normal SET NOT NULL,
  ALTER COLUMN price_cash SET DEFAULT 0,
  ALTER COLUMN price_cash SET NOT NULL;
