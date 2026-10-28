-- The only relation public endpoints read. See CLAUDE.md "Non-negotiable rules".
CREATE VIEW public_channels AS
SELECT
  c.id,
  c.name,
  c.alt_names,
  c.network,
  c.country_code,
  c.categories,
  c.website,
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
  best.quality AS best_quality
FROM channels c
JOIN channel_curation k ON k.channel_id = c.id AND k.status = 'approved'
JOIN LATERAL (
  SELECT s.id AS stream_id, h.score, h.height, s.quality
  FROM streams s
  JOIN stream_health h ON h.stream_id = s.id
  WHERE s.channel_id = c.id AND h.web_playable AND h.score >= 50
  ORDER BY h.score DESC, h.height DESC NULLS LAST
  LIMIT 1
) best ON true
WHERE c.closed IS NULL
  AND NOT c.is_nsfw
  AND NOT EXISTS (SELECT 1 FROM blocklist b WHERE b.channel_id = c.id);
