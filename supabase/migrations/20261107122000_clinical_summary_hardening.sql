-- Trigger functions must not be callable through the REST RPC endpoint.
revoke execute on function public.trg_summary_stale_profile() from public, anon, authenticated;
revoke execute on function public.trg_summary_stale_document() from public, anon, authenticated;
revoke execute on function public.trg_summary_stale_consultation() from public, anon, authenticated;
revoke execute on function public.trg_summary_stale_ai_diagnosis() from public, anon, authenticated;
revoke execute on function public.trg_summary_stale_vitals() from public, anon, authenticated;
alter function public.guard_consultation_hpi_update() set search_path = public;
