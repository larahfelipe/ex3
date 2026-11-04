ALTER TABLE "users" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- No split of a stored name is right for every name, so each one is kept whole,
-- trimmed, as the first name, and the full name read from it stays the same.
UPDATE "users"
SET "firstName" = NULLIF(regexp_replace("name", '^\s+|\s+$', '', 'g'), '');
