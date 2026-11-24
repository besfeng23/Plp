-- Applied to dedicated PLP as version 20261124115700. Pending folder keeps
-- this after the historical preview-gate table migration on clean rebuilds.
CREATE OR REPLACE FUNCTION plp_runtime.plp_reserve_preview_attempt(p_ip_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE cutoff timestamptz := clock_timestamp() - interval '15 minutes';
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(1600241124);
  IF (SELECT count(*) FROM plp_runtime.plp_preview_gate_events WHERE kind='fail' AND created_at>=cutoff AND ip_hash=p_ip_hash)>=5
     OR (SELECT count(*) FROM plp_runtime.plp_preview_gate_events WHERE kind='fail' AND created_at>=cutoff)>=30 THEN RETURN false; END IF;
  INSERT INTO plp_runtime.plp_preview_gate_events(kind,ip_hash) VALUES('fail',p_ip_hash);
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION plp_runtime.plp_reserve_preview_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION plp_runtime.plp_reserve_preview_attempt(text) TO service_role;
CREATE INDEX IF NOT EXISTS plp_preview_gate_events_kind_created_idx ON plp_runtime.plp_preview_gate_events(kind,created_at DESC);
NOTIFY pgrst, 'reload schema';
