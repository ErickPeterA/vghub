import { useEffect, useState, useCallback } from "react";
import { getSessionSafely, type LocalSession } from "@/lib/auth-safe";
import { apiJson } from "@/lib/api";

export type CurrentUser = {
  session: LocalSession | null;
  user: LocalSession["user"] | null;
  isAdmin: boolean;
  profile: { id: string; nome: string; email: string; status: string } | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

type ApiMePayload = {
  ok: boolean;
  localUser: {
    profile: CurrentUser["profile"];
    isAdmin: boolean;
  } | null;
  permissions: {
    provisioned: boolean;
    isAdmin: boolean;
  };
};

export function useCurrentUser(): CurrentUser {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<CurrentUser["profile"]>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: LocalSession | null) => {
    if (!s?.user) {
      return { isAdmin: false, profile: null as CurrentUser["profile"] };
    }

    try {
      const me = await apiJson<ApiMePayload>("/api/me");
      return {
        isAdmin: me.permissions.isAdmin,
        profile: me.localUser?.profile ?? null,
      };
    } catch {
      return { isAdmin: false, profile: null as CurrentUser["profile"] };
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const nextSession = await getSessionSafely();
    const nextUser = await load(nextSession);
    setSession(nextSession);
    setIsAdmin(nextUser.isAdmin);
    setProfile(nextUser.profile);
    setLoading(false);
  }, [load]);

  useEffect(() => {
    let active = true;
    const applySession = async (nextSession: LocalSession | null) => {
      if (!active) return;
      setSession(nextSession);
      const nextUser = await load(nextSession);
      if (!active) return;
      setIsAdmin(nextUser.isAdmin);
      setProfile(nextUser.profile);
      setLoading(false);
    };

    getSessionSafely().then(applySession);

    return () => {
      active = false;
    };
  }, [load]);

  return { session, user: session?.user ?? null, isAdmin, profile, loading, refresh };
}
