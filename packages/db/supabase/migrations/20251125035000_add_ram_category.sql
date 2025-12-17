-- Add RAM (Memory) category
INSERT INTO categories (name, slug)
VALUES ('RAM', 'ram')
ON CONFLICT (slug) DO NOTHING;
