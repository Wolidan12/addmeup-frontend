import {supabase} from '../lib/supabase'
import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ArrowUpRight, Bookmark, Check, Link2 } from "lucide-react";
import { useSite } from "../context/SiteContext";
import PlatformLogo from "./PlatformLogo";
import { socialHref, validSocialUrl } from "../lib/validation";
export const LABELS = {
  whatsapp: "WhatsApp",
  snapchat: "Snapchat",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X",
  youtube:"YouTube",telegram:"Telegram",
};
export function SocialBadge({ platform, url, campaign, profile }) {
  const site=useSite();const label=site.platforms?.find(p=>p.key===platform)?.label||LABELS[platform]||platform;
  if (!validSocialUrl(platform, url,site.platforms)) return null;
  return (
    <a
      className="creator-social"
      onClick={()=>{if(campaign)supabase.rpc('record_promotion_event',{p_campaign:campaign,p_profile:profile,p_kind:'social_open',p_platform:platform}).then(()=>{}).catch(()=>{})}}
      href={socialHref(platform, url)}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      aria-label={`Open ${label} profile`}
    >
      <PlatformLogo platform={platform} size={24} />
      <span>{label}</span>
      <ArrowUpRight size={12} />
    </a>
  );
}
export function ProfileCard({ p, onSave, saved }) {
  const site = useSite(),
    [imageFailed, setImageFailed] = useState(false),
    path = `/${p.managed ? "listing" : "profile"}/${p.username}${p.promotion_id?'?promotion='+encodeURIComponent(p.promotion_id):''}`,
    links = (p.social_links || []).filter(
      (l) =>
        l.is_public &&
        site.enabled_platforms.includes(l.platform) &&
        validSocialUrl(l.platform, l.url,site.platforms),
    );
  return (
    <article className={"creator-card"+(p.promotion_id?" creator-card-paid":"")}>
      <div className="creator-card-cover">
        <span>
          <Link2 size={15} />{" "}
          {p.managed
            ? "Managed listing"
            : p.promotion_id
              ? "Paid promotion · "+p.promotion_kind
              : "Community creator"}
        </span>
        {onSave && (
          <button
            type="button"
            onClick={() => onSave(p)}
            aria-pressed={saved}
            aria-label={saved ? "Unsave creator" : "Save creator"}
          >
            {saved ? <Check size={17} /> : <Bookmark size={17} />}
          </button>
        )}
      </div>
      <div className="creator-card-main"><span className="creator-editorial-label">A WORLD WORTH DISCOVERING</span>
        <Link
          to={path}
          className="creator-avatar"
          aria-label={`${p.display_name} profile`}
        >
          {p.avatar_url && !imageFailed ? (
            <img
              src={p.avatar_url}
              alt=""
              loading="lazy" referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span>{(p.display_name || p.username || "?")[0]}</span>
          )}
        </Link>
        <Link to={path} className="creator-name">
          {p.display_name}
        </Link>
        {p.paid_premium_badge&&<span className="paid-cosmetic-badge">Paid Premium badge · cosmetic, not verification</span>}
        {p.promotion_copy&&<p className="promotion-copy">{p.promotion_copy}</p>}
        <p className="creator-handle">@{p.username}</p>
        {p.country && (
          <span className="creator-location">
            <MapPin size={12} />
            {p.country}
          </span>
        )}
        <p className="creator-bio">
          {p.bio || "A new connection waiting to happen."}
        </p>
        <div className="creator-interests">
          {(p.interests || []).slice(0, 3).map((i) => (
            <span key={i}>{i}</span>
          ))}
          {p.interests?.length > 3 && <span>+{p.interests.length - 3}</span>}
        </div>
        <div className="creator-socials">
          {links.map((l) => (
            <SocialBadge campaign={p.promotion_id} profile={p.id} key={l.platform} {...l} />
          ))}
        </div>
        <Link className="creator-profile-link" to={path}>
          Discover this creator <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
export function States({ loading, error, empty }) {
  if (loading)
    return (
      <div className="design-empty" role="status">
        <span className="design-loader" />
        Loading profile…
      </div>
    );
  if (error)
    return (
      <div role="alert" className="design-alert danger">
        {error}
      </div>
    );
  if (empty)
    return (
      <div className="design-empty">
        <h2>No profiles found</h2>
        <p>Try widening your filters.</p>
      </div>
    );
  return null;
}
