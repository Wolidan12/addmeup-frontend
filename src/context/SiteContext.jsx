import { withTimeout } from "../lib/errors";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { PLATFORMS, PLATFORM_HOSTS } from "../lib/validation";
const labels = {
  whatsapp: "WhatsApp",
  snapchat: "Snapchat",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X",
  youtube: "YouTube",
  telegram: "Telegram",
};
const defaults = {
  brand_name: "Danqel Social Boost",
  hero_title: "Good connections. Greater reach.",
  hero_description:
    "Meet creators, share your social profiles and make meaningful connections.",
  maintenance_mode: false,
  enabled_platforms: PLATFORMS,
  platforms: PLATFORMS.map((key) => ({
    key,
    label: labels[key],
    hosts: PLATFORM_HOSTS[key] || ["wa.me"],
  })),
};
const C = createContext(defaults);
export const useSite = () => useContext(C);
export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(defaults),
    reload = useRef(() => {});
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const load = () =>
      withTimeout(
        Promise.all([
          supabase.from("site_settings").select("*").eq("id", true).single(),
          supabase
            .from("social_platforms")
            .select("key,label,hosts")
            .order("label"),
        ]),
      )
        .then(([site, catalogue]) => {
          if (active && site.data)
            setSettings({
              ...site.data,
              platforms: catalogue.data?.length
                ? catalogue.data
                : defaults.platforms,
            });
        })
        .catch(() => {
          /* Preserve safe public defaults; no raw setup/provider messages. */
        });
    reload.current = load;
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
      reload.current = () => {};
    };
  }, []);
  return (
    <C.Provider value={{ ...settings, refresh: () => reload.current() }}>
      {children}
    </C.Provider>
  );
}
