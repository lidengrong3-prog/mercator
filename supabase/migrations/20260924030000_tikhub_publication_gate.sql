-- Promote only operator-verified, field-allowlisted TikHub snapshots.
-- Collection remains private by default; this migration adds the explicit
-- authorization gate needed before the product/shop/content pages can show
-- third-party snapshots as formal data.

BEGIN;

-- Content collection uses the same provider credentials but a separate
-- allowlist so a product/shop pilot can never silently expand its request
-- surface.
ALTER TABLE public.tikhub_endpoint_catalog
  DROP CONSTRAINT IF EXISTS tikhub_endpoint_catalog_endpoint_key_check;
ALTER TABLE public.tikhub_endpoint_catalog
  ADD CONSTRAINT tikhub_endpoint_catalog_endpoint_key_check CHECK (endpoint_key IN (
    'product_search', 'product_detail', 'seller_profile', 'shop_analytics',
    'video_search', 'video_detail', 'creator_profile', 'video_product_relation'
  ));

INSERT INTO public.tikhub_endpoint_catalog
  (endpoint_key, endpoint_url, endpoint_path, http_method, auth_mode,
   requires_cookie, production_automation_allowed, authorization_status, enabled, notes)
VALUES
  ('video_search', NULL, NULL, 'GET', 'bearer', FALSE, FALSE, 'pending', FALSE, 'TikHub 视频搜索；需先确认商业授权和实际 endpoint。'),
  ('video_detail', NULL, NULL, 'GET', 'bearer', FALSE, FALSE, 'pending', FALSE, 'TikHub 视频详情；需先确认商业授权和实际 endpoint。'),
  ('creator_profile', NULL, NULL, 'GET', 'bearer', FALSE, FALSE, 'pending', FALSE, 'TikHub 达人资料；需先确认商业授权和实际 endpoint。'),
  ('video_product_relation', NULL, NULL, 'GET', 'bearer', FALSE, FALSE, 'pending', FALSE, 'TikHub 视频与商品关联；需先确认商业授权和实际 endpoint。')
ON CONFLICT (endpoint_key) DO UPDATE SET updated_at = NOW();

-- Content runs have a distinct pilot key so they cannot collide with the
-- four-endpoint product/shop pilot ledger on the same UTC date.
INSERT INTO public.tikhub_pilot_configs(
  pilot_key, market_code, platform_key, keywords, cadence_per_day, pilot_days,
  api_key_secret_name, cookie_endpoint_policy, authorization_status, status,
  enabled, market_codes, platform_keys, scope_status, notes
)
SELECT 'tiktok-shop-' || lower(config.market_code) || '-content-pilot',
       config.market_code, config.platform_key, config.keywords,
       config.cadence_per_day, config.pilot_days, config.api_key_secret_name,
       config.cookie_endpoint_policy, 'pending', 'draft', FALSE,
       config.market_codes, config.platform_keys, config.scope_status,
       '内容快照试点：视频、达人、商品关联和互动指标；需单独完成授权。'
  FROM public.tikhub_pilot_configs AS config
 WHERE config.pilot_key = 'tiktok-shop-us-pilot'
ON CONFLICT (pilot_key) DO NOTHING;

INSERT INTO public.tikhub_field_mappings
  (endpoint_key, source_path, target_table, target_field, data_type,
   nullable, commercial_authorized, public_display_allowed, notes)
VALUES
  ('video_search', 'id|video_id|aweme_id', 'content_snapshots', 'platform_content_id', 'text', FALSE, FALSE, FALSE, NULL),
  ('video_search', 'title|description|caption', 'content_snapshots', 'metrics', 'jsonb', TRUE, FALSE, FALSE, NULL),
  ('video_search', 'author_id|creator_id|user_id', 'content_snapshots', 'metrics', 'jsonb', TRUE, FALSE, FALSE, NULL),
  ('video_search', 'product_id|item_id', 'content_snapshots', 'metrics', 'jsonb', TRUE, FALSE, FALSE, NULL),
  ('video_detail', 'id|video_id|aweme_id', 'content_snapshots', 'platform_content_id', 'text', FALSE, FALSE, FALSE, NULL),
  ('video_detail', 'views|play_count|plays', 'content_snapshots', 'views', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('video_detail', 'likes|like_count', 'content_snapshots', 'likes', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('video_detail', 'comments|comment_count', 'content_snapshots', 'comments', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('video_detail', 'shares|share_count', 'content_snapshots', 'shares', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('video_detail', 'conversions|orders', 'content_snapshots', 'conversions', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('creator_profile', 'id|creator_id|user_id', 'content_snapshots', 'metrics', 'jsonb', FALSE, FALSE, FALSE, NULL),
  ('creator_profile', 'followers|fans', 'content_snapshots', 'metrics', 'jsonb', TRUE, FALSE, FALSE, NULL),
  ('video_product_relation', 'product_id|item_id', 'content_snapshots', 'metrics', 'jsonb', FALSE, FALSE, FALSE, NULL),
  ('video_product_relation', 'shop_id|seller_id', 'content_snapshots', 'metrics', 'jsonb', TRUE, FALSE, FALSE, NULL)
ON CONFLICT (endpoint_key, source_path, target_table, target_field) DO UPDATE SET
  commercial_authorized = EXCLUDED.commercial_authorized,
  public_display_allowed = EXCLUDED.public_display_allowed;

CREATE TABLE IF NOT EXISTS public.tikhub_publication_reviews (
  raw_source_record_id UUID PRIMARY KEY REFERENCES public.raw_source_records(id) ON DELETE RESTRICT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'rejected')),
  approved_display_fields TEXT[] NOT NULL DEFAULT '{}',
  approved_export_fields TEXT[] NOT NULL DEFAULT '{}',
  reviewer TEXT NOT NULL,
  notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (cardinality(approved_display_fields) > 0 OR verification_status = 'rejected')
);

ALTER TABLE public.tikhub_publication_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tikhub_publication_reviews FROM anon, authenticated;
GRANT ALL ON public.tikhub_publication_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.review_tikhub_publication(
  p_raw_source_record_id UUID,
  p_approved_display_fields TEXT[],
  p_reviewer TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.tikhub_publication_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_row public.tikhub_publication_reviews%ROWTYPE;
  policy_row public.data_source_access_policies%ROWTYPE;
  approved_fields TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.raw_source_records
     WHERE id = p_raw_source_record_id AND source_key = 'tikhub'
  ) THEN
    RAISE EXCEPTION 'TikHub raw record not found' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(TRIM(COALESCE(p_reviewer, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reviewer is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO policy_row FROM public.data_source_access_policies WHERE source_key = 'tikhub';
  approved_fields := ARRAY(SELECT DISTINCT TRIM(value)
                             FROM unnest(COALESCE(p_approved_display_fields, '{}')) value
                            WHERE TRIM(value) <> '');
  IF EXISTS (
    SELECT 1 FROM unnest(approved_fields) field
     WHERE NOT (field = ANY(policy_row.allowed_display_fields))
        OR NOT EXISTS (
          SELECT 1 FROM public.tikhub_field_mappings mapping
           WHERE mapping.target_field = field
             AND mapping.commercial_authorized = TRUE
             AND mapping.public_display_allowed = TRUE
        )
  ) THEN
    RAISE EXCEPTION 'approved fields are outside the governed TikHub allowlist' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.tikhub_publication_reviews(
    raw_source_record_id, verification_status, approved_display_fields,
    reviewer, notes, reviewed_at
  ) VALUES (
    p_raw_source_record_id, 'verified',
    approved_fields,
    LEFT(TRIM(p_reviewer), 160), LEFT(NULLIF(TRIM(p_notes), ''), 2000), NOW()
  ) ON CONFLICT (raw_source_record_id) DO UPDATE SET
    verification_status = EXCLUDED.verification_status,
    approved_display_fields = EXCLUDED.approved_display_fields,
    reviewer = EXCLUDED.reviewer,
    notes = EXCLUDED.notes,
    reviewed_at = NOW()
  RETURNING * INTO result_row;
  IF cardinality(result_row.approved_display_fields) = 0 THEN
    RAISE EXCEPTION 'at least one approved display field is required' USING ERRCODE = '22023';
  END IF;
  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.source_is_publishable(p_source_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.source_is_collectable(p_source_key)
     AND EXISTS (
       SELECT 1
         FROM public.data_source_registry AS registry
         JOIN public.data_source_access_policies AS policy USING (source_key)
        WHERE registry.source_key = p_source_key
          AND registry.source_category IN (
            'official_policy', 'official_statistics', 'platform_announcement',
            'third_party_provider'
          )
          AND policy.authorization_status IN ('confirmed', 'not_required')
          AND policy.commercial_use_allowed = TRUE
          AND policy.redistribution_allowed = TRUE
          AND 'public_summary' = ANY(policy.permitted_uses)
          AND cardinality(policy.allowed_display_fields) > 0
     );
$$;

CREATE OR REPLACE FUNCTION public.guard_formal_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE raw_record public.raw_source_records%ROWTYPE;
BEGIN
  IF NOT public.source_is_publishable(NEW.source_key) THEN
    RAISE EXCEPTION 'source % is not authorized for formal publication', NEW.source_key
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO raw_record
    FROM public.raw_source_records
   WHERE id = NEW.raw_source_record_id;
  IF NOT FOUND
     OR raw_record.source_key <> NEW.source_key
     OR NOT (
       (raw_record.publication_status = 'eligible'
        AND raw_record.verification_status IN ('verified', 'uploaded'))
       OR EXISTS (
         SELECT 1 FROM public.tikhub_publication_reviews review
          WHERE review.raw_source_record_id = raw_record.id
            AND review.verification_status = 'verified'
       )
     ) THEN
    RAISE EXCEPTION 'formal publication requires matching eligible verified evidence'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_tikhub_formal_publications(p_limit INTEGER DEFAULT 1000)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_row public.raw_source_records%ROWTYPE;
  review_row public.tikhub_publication_reviews%ROWTYPE;
  policy_row public.data_source_access_policies%ROWTYPE;
  snapshot_id UUID;
  publication_id UUID;
  publication_type TEXT;
  promoted_count INTEGER := 0;
  examined_count INTEGER := 0;
  allowed_payload JSONB;
BEGIN
  IF NOT public.source_is_publishable('tikhub') THEN
    RAISE EXCEPTION 'TikHub is not authorized for formal publication'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO policy_row
    FROM public.data_source_access_policies
   WHERE source_key = 'tikhub';

  FOR raw_row IN
    SELECT *
      FROM public.raw_source_records
     WHERE source_key = 'tikhub'
       AND status = 'active'
       AND publication_status = 'quarantined'
       AND EXISTS (
         SELECT 1 FROM public.tikhub_publication_reviews review
          WHERE review.raw_source_record_id = raw_source_records.id
            AND review.verification_status = 'verified'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.formal_publications publication
          WHERE publication.raw_source_record_id = raw_source_records.id
       )
     ORDER BY collected_at, id
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 1000), 10000))
     FOR UPDATE SKIP LOCKED
  LOOP
    examined_count := examined_count + 1;
    SELECT * INTO review_row FROM public.tikhub_publication_reviews
     WHERE raw_source_record_id = raw_row.id AND verification_status = 'verified';
    -- The raw evidence is append-only. Review metadata supplies the approved
    -- field allowlist for this formal projection without mutating evidence.
    allowed_payload := public.allowlisted_jsonb(
      raw_row.payload, review_row.approved_display_fields
    );
    IF raw_row.domain = 'product' THEN
      publication_type := 'product_snapshot';
      SELECT id INTO snapshot_id FROM public.product_snapshots
       WHERE raw_source_record_id = raw_row.id ORDER BY collected_at DESC LIMIT 1;
    ELSIF raw_row.domain = 'shop' THEN
      publication_type := 'shop_snapshot';
      SELECT id INTO snapshot_id FROM public.shop_snapshots
       WHERE raw_source_record_id = raw_row.id ORDER BY collected_at DESC LIMIT 1;
    ELSIF raw_row.domain = 'content' THEN
      publication_type := 'content_snapshot';
      SELECT id INTO snapshot_id FROM public.content_snapshots
       WHERE raw_source_record_id = raw_row.id ORDER BY collected_at DESC LIMIT 1;
    ELSE
      snapshot_id := NULL;
      publication_type := NULL;
    END IF;

    IF snapshot_id IS NULL OR publication_type IS NULL THEN
      -- Do not create a formal row when its normalized snapshot is missing.
      CONTINUE;
    END IF;

    publication_id := public.history_uuid(
      'formal-publication', raw_row.id::TEXT || '|' || publication_type || '|' || snapshot_id::TEXT
    );
    INSERT INTO public.formal_publications (
      id, source_key, raw_source_record_id, product_snapshot_id,
      shop_snapshot_id, content_snapshot_id, publication_type, domain,
      record_key, market_code, platform_key, category_code, status, title,
      summary, source_url, published_at, collected_at, first_seen_at,
      last_seen_at, evidence_hash, public_payload
    ) VALUES (
      publication_id, raw_row.source_key, raw_row.id,
      CASE WHEN publication_type = 'product_snapshot' THEN snapshot_id END,
      CASE WHEN publication_type = 'shop_snapshot' THEN snapshot_id END,
      CASE WHEN publication_type = 'content_snapshot' THEN snapshot_id END,
      publication_type, raw_row.domain, raw_row.normalized_record_key,
      raw_row.market_codes[1], raw_row.platform_keys[1], raw_row.category_codes[1],
      'active', COALESCE(raw_row.payload->>'title', raw_row.payload->>'name', raw_row.normalized_record_key),
      raw_row.payload->>'summary', raw_row.source_url, raw_row.published_at,
      raw_row.collected_at, raw_row.first_seen_at, raw_row.last_seen_at,
      raw_row.evidence_hash, allowed_payload
    ) ON CONFLICT (id) DO NOTHING;
    promoted_count := promoted_count + 1;
  END LOOP;

  RETURN jsonb_build_object('examined', examined_count, 'promoted', promoted_count,
                           'source_key', 'tikhub', 'authorization_required', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.review_tikhub_publication(UUID, TEXT[], TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_tikhub_publication(UUID, TEXT[], TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.promote_tikhub_formal_publications(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_tikhub_formal_publications(INTEGER) TO service_role;

COMMENT ON FUNCTION public.promote_tikhub_formal_publications(INTEGER) IS
  'Service-only gate: publishes verified TikHub snapshots only after commercial/public authorization and field allowlisting.';

COMMIT;
