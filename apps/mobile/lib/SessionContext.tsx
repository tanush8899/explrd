import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type SessionState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
};

const SessionContext = createContext<SessionState>({
  loading: true,
  session: null,
  user: null,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    loading: true,
    session: null,
    user: null,
  });

  useEffect(() => {
    let mounted = true;

    // Restore session from AsyncStorage on cold start
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setState({ loading: false, session, user: session?.user ?? null });
    });

    // Keep session in sync (token refresh, sign-in, sign-out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      if (!mounted) return;
      setState({ loading: false, session, user: session?.user ?? null });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
