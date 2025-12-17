-- Set default timezone to Chile (America/Santiago)
-- This affects how timestamps are displayed when queried without explicit timezone conversion

-- Set the database timezone to Chile
ALTER DATABASE postgres SET timezone TO 'America/Santiago';
-- Also set for current session
SET timezone TO 'America/Santiago';
-- Note: Timestamps stored with timezone (timestamptz) will still be stored in UTC internally,
-- but will be displayed in Chile time when queried.
-- This is the recommended approach as it maintains data integrity while showing local time.;
