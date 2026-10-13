-- Re-band stored Codeforces and AtCoder problems after the cutoffs in lib/sync/difficulty.ts moved
-- (CF 1200/1400/1700/2100, AtCoder 400/600/900/1300). LeetCode bands are unchanged.
UPDATE "problems" SET "difficulty_norm" = CASE
  WHEN "difficulty_raw"::numeric < 1200 THEN 1
  WHEN "difficulty_raw"::numeric < 1400 THEN 2
  WHEN "difficulty_raw"::numeric < 1700 THEN 3
  WHEN "difficulty_raw"::numeric < 2100 THEN 4
  ELSE 5
END
WHERE "platform" = 'codeforces' AND "difficulty_raw" ~ '^-?[0-9]+(\.[0-9]+)?$';
--> statement-breakpoint
UPDATE "problems" SET "difficulty_norm" = CASE
  WHEN "difficulty_raw"::numeric < 400 THEN 1
  WHEN "difficulty_raw"::numeric < 600 THEN 2
  WHEN "difficulty_raw"::numeric < 900 THEN 3
  WHEN "difficulty_raw"::numeric < 1300 THEN 4
  ELSE 5
END
WHERE "platform" = 'atcoder' AND "difficulty_raw" ~ '^-?[0-9]+(\.[0-9]+)?$';
