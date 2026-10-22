-- GFG practice pages live under /problems/<slug>/1; extension 0.3.4 and older stored the bare
-- slug, which is a 404. Uploads are fixed in lib/extension-upload.ts problemUrl().
UPDATE "problems"
SET "url" = regexp_replace("url", '/?$', '/1')
WHERE "platform" = 'gfg'
  AND "url" ~ '^https://(www|practice)\.geeksforgeeks\.org/problems/[^/]+/?$';
