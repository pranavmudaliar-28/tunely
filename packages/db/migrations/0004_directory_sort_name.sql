-- Sort A–Z by letters and digits, so names like "&TV" or "+MaisUm" don't jump ahead of "A".
DROP MATERIALIZED VIEW IF EXISTS public_channels;
--> statement-breakpoint
CREATE MATERIALIZED VIEW public_channels AS
SELECT
  c.id,
  c.name,
  c.alt_names,
  c.network,
  c.country_code,
  c.categories,
  c.website,
  lower(coalesce(nullif(regexp_replace(c.name, '^[^[:alnum:]]+', ''), ''), c.name)) AS sort_name,
  coalesce(
    (SELECT array_agg(DISTINCT l ORDER BY l) FROM feeds f, unnest(f.languages) l WHERE f.channel_id = c.id),
    '{}'
  ) AS languages,
  (SELECT lg.url FROM logos lg
    WHERE lg.channel_id = c.id AND lg.in_use
    ORDER BY (lg.feed_id = '') DESC, lg.width DESC NULLS LAST
    LIMIT 1) AS logo_url,
  best.stream_id AS best_stream_id,
  best.score AS best_score,
  best.height AS best_height,
  best.quality AS best_quality,
  CASE
    WHEN c.closed IS NOT NULL THEN 'closed'
    WHEN best.stream_id IS NOT NULL THEN 'live'
    WHEN EXISTS (SELECT 1 FROM streams s WHERE s.channel_id = c.id) THEN 'offline'
    ELSE 'no_stream'
  END AS status,
  CASE
    WHEN c.closed IS NOT NULL THEN 3
    WHEN best.stream_id IS NOT NULL THEN 0
    WHEN EXISTS (SELECT 1 FROM streams s WHERE s.channel_id = c.id) THEN 1
    ELSE 2
  END::smallint AS status_rank
FROM channels c
LEFT JOIN channel_curation k ON k.channel_id = c.id
LEFT JOIN LATERAL (
  SELECT s.id AS stream_id, h.score, h.height, s.quality
  FROM streams s
  JOIN stream_health h ON h.stream_id = s.id
  WHERE s.channel_id = c.id AND h.web_playable AND h.score >= 50
  ORDER BY h.score DESC, h.height DESC NULLS LAST
  LIMIT 1
) best ON true
WHERE NOT c.is_nsfw
  AND coalesce(k.status, 'pending') NOT IN ('hidden', 'removed')
  AND NOT EXISTS (SELECT 1 FROM blocklist b WHERE b.channel_id = c.id);

--> statement-breakpoint
CREATE UNIQUE INDEX public_channels_id ON public_channels (id);
--> statement-breakpoint
CREATE INDEX public_channels_order ON public_channels (status_rank, sort_name, id);
--> statement-breakpoint
CREATE INDEX public_channels_country ON public_channels (country_code, status_rank, sort_name);
--> statement-breakpoint
CREATE INDEX public_channels_categories ON public_channels USING gin (categories);
--> statement-breakpoint
CREATE INDEX public_channels_languages ON public_channels USING gin (languages);
--> statement-breakpoint
CREATE INDEX public_channels_name_trgm ON public_channels USING gin (name gin_trgm_ops);
