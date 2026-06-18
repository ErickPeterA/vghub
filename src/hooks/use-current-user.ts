import { useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CurrentUser = {
  session: Session | null;
  user: Session["user"] | null;
  isAdmin: boolean;
  profile: { id: string; nome: string; email: string; status: string } | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useCurrentUser(): CurrentUser {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<CurrentUser["profile"]>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    if (!s?.user) {
      setIsAdmin(false);
      setProfile(null);
      return;
    }
    const [{ data: roleRow }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", s.user.id).eq("role", "admin").maybeSingle(),
      supabase.from("profiles").select("id,nome,email,status").eq("id", s.user.id).maybeSingle(),
    ]);
    setIsAdmin(!!roleRow);
    setProfile(prof as CurrentUser["profile"]);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  useEffect(() => {
    let active = true;
    // Get initial session first
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session);
      setLoading(false);
    });
    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!active) return;
      setSession(s);
      await load(s);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [load]);

  return { session, user: session?.user ?? null, isAdmin, profile, loading, refresh };
}
