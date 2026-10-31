import { withTimeout } from "../lib/errors";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
const C = createContext(null);
export const useMember = () => useContext(C);
export function MemberProvider({ children }) {
  const { user } = useAuth(),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [referralNotice, setReferralNotice] = useState(""),
    tried = useRef(null),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!isSupabaseConfigured) {
      setData(null);
      setError(
        "Your workspace is temporarily unavailable. Please try again later.",
      );
      setBusy(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await withTimeout(supabase.rpc("member_overview"));
      if (result.error) throw result.error;
      if (request === generation.current) {
        if (result.data?.profile?.id !== user.id)
          throw new Error("Account changed");
        setData(result.data);
      }
    } catch {
      if (request === generation.current)
        setError("We couldn’t refresh your workspace. Please try again.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }, [user.id]);
  useEffect(() => {
    setData(null);
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60000);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!data || data.profile?.id !== user.id || tried.current === user.id)
      return;
    tried.current = user.id;
    let code;
    try {
      code = localStorage.getItem("danqel_pending_referral");
    } catch {
      return;
    }
    if (!code) return;
    if (data.referred_by) {
      try {
        localStorage.removeItem("danqel_pending_referral");
      } catch {}
      return;
    }
    let active = true;
    withTimeout(supabase.rpc("apply_referral", { p_code: code }))
      .then(({ error }) => {
        if (!active) return;
        if (error)
          setReferralNotice(
            "Your referral link could not be applied. Open Referrals to review the code.",
          );
        else {
          try {
            localStorage.removeItem("danqel_pending_referral");
          } catch {}
          setReferralNotice("Your referral has been linked.");
        }
      })
      .catch(() => {
        if (active)
          setReferralNotice(
            "Your referral could not be confirmed. Open Referrals to check before retrying.",
          );
      });
    return () => {
      active = false;
    };
  }, [data, user.id]);
  return (
    <C.Provider value={{ data, error, busy, refresh, referralNotice }}>
      {children}
    </C.Provider>
  );
}
