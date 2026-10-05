import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, getToken, setToken, UNAUTHORIZED_EVENT } from "./api";
import type { Role, User } from "./types";

interface AuthState {
  user: User | null;
  // True until the stored token has been checked against the backend, so the
  // app does not flash the sign-in screen at an already-signed-in user.
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    organization?: string;
  }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // With no stored token there is nothing to verify, so the app is ready at
  // once rather than rendering a spinner and then clearing it in an effect.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // A token in localStorage proves nothing: it may be expired or signed with
  // a key the backend has since changed. /api/auth/me is the check.
  useEffect(() => {
    let cancelled = false;

    if (!getToken()) return;

    api
      .me()
      .then(({ user: me }) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // request() already cleared the token on a 401.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Any request that comes back 401 signs the user out, so an expired session
  // does not leave the UI showing data it can no longer refresh.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: signedIn, token } = await api.login({ email, password });
    setToken(token);
    setUser(signedIn);
  }, []);

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      role: Role;
      organization?: string;
    }) => {
      const { user: created, token } = await api.register(input);
      setToken(token);
      setUser(created);
    },
    []
  );

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider.");
  return context;
}
