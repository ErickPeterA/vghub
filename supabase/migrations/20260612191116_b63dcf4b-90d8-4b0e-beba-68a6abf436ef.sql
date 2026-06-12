REVOKE ALL ON FUNCTION public.clone_general_base_to_project(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clone_general_base_to_project(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.clone_base_on_project_create() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_base_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_project_base(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_project_base(uuid, uuid) TO authenticated, service_role;