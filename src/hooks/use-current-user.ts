import { useEffect, useState } from "react";
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

  const load = async (s: Session | null) => {
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
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await load(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, isAdmin, profile, loading, refresh };
}
