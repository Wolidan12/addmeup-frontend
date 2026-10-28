import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { withTimeout } from "../lib/errors";
const C = createContext(null);
export const useAuth = () => useContext(C);
const unavailable = () => ({ error: { code: "service_unavailable" } });
function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [sessionError, setSessionError] = useState(""),
    generation = useRef(0);
  const retrySession = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setSessionError("");
    if (!isSupabaseConfigured) {
      setUser(null);
      setLoading(false);
      setSessionError(
        "Account services are temporarily unavailable. Please try again later.",
      );
      return;
    }
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession());
      if (error) throw error;
      if (request === generation.current) setUser(data.session?.user || null);
    } catch {
      if (request === generation.current) {
        setUser(null);
        setSessionError(
          "We could not restore your session. Check your connection and try again.",
        );
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.removeItem("danqel_demo_user");
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[a-zA-Z0-9-]{4,64}$/.test(ref))
        localStorage.setItem("danqel_pending_referral", ref);
    } catch {
      /* Privacy settings may disable browser storage. Real Auth still determines access. */
    }
    retrySession();
    if (!isSupabaseConfigured)
      return () => {
        generation.current++;
      };
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      generation.current++;
      setUser(session?.user || null);
      setLoading(false);
      setSessionError("");
    });
    return () => {
      generation.current++;
      data.subscription.unsubscribe();
    };
  }, [retrySession]);
  const signUp = async (email, password) => {
    if (!isSupabaseConfigured) return unavailable();
    const ref = storageGet("danqel_pending_referral");
    return withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            window.location.origin +
            "/verify" +
            (ref ? "?ref=" + encodeURIComponent(ref) : ""),
        },
      }),
    );
  };
  const signIn = async (email, password) =>
    isSupabaseConfigured
      ? withTimeout(supabase.auth.signInWithPassword({ email, password }))
      : unavailable();
  const signOut = async () => {
    if (isSupabaseConfigured) {
      const { error } = await withTimeout(supabase.auth.signOut());
      if (error) throw error;
    }
    generation.current++;
    setUser(null);
  };
  const reset = async (email) =>
    isSupabaseConfigured
      ? withTimeout(
          supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + "/reset-password",
          }),
        )
      : unavailable();
  return (
    <C.Provider
      value={{
        user,
        loading,
        sessionError,
        retrySession,
        signUp,
        signIn,
        signOut,
        reset,
      }}
    >
      {children}
    </C.Provider>
  );
}
