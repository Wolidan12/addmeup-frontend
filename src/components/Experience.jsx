import {
  ArrowUpRight,
  Orbit,
  ShieldCheck,
  Sparkles,
  Radio,
} from "lucide-react";
import { Link } from "react-router-dom";
import PlatformLogo from "./PlatformLogo";
export function BrandScene({ compact = false }) {
  return (
    <div
      className={"brand-scene " + (compact ? "compact" : "")}
      role="img"
      aria-label="Danqel connects your social world"
    >
      <div className="scene-grid" />
      <div className="scene-orbit orbit-a" />
      <div className="scene-orbit orbit-b" />
      <div className="scene-orbit orbit-c" />
      <div className="scene-core">
        <img src="/brand/danqel-mark.webp" width="180" height="180" alt="" />
      </div>
      {["instagram", "whatsapp", "tiktok", "x"].map((platform, i) => (
        <span key={platform} className={"scene-node node-" + i}>
          <PlatformLogo platform={platform} size={30} />
        </span>
      ))}
      <span className="scene-signal">
        <Radio size={14} /> MADE FOR REAL CONNECTIONS
      </span>
      <span className="scene-coordinate">DANQEL / SOCIAL TECHNOLOGY</span>
    </div>
  );
}
export function ExperienceBanner({
  eyebrow = "CONNECT. ENGAGE. GROW.",
  title,
  description,
  icon: Icon = Orbit,
  action,
  to,
}) {
  return (
    <section className="experience-banner">
      <div>
        <span className="signal-eyebrow">
          <i />
          {eyebrow}
        </span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {to && (
          <Link className="design-button primary" to={to}>
            {action}
            <ArrowUpRight size={17} />
          </Link>
        )}
      </div>
      <div className="experience-emblem" aria-hidden="true">
        <span />
        <span />
        <Icon size={54} />
      </div>
    </section>
  );
}
export function EmptyState({
  title,
  description,
  to,
  label,
  icon: Icon = Sparkles,
}) {
  return (
    <div className="premium-empty">
      <span>
        <Icon size={29} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {to && (
        <Link className="design-button secondary" to={to}>
          {label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function TrustStrip() {
  return (
    <div className="premium-trust">
      <ShieldCheck size={15} />
      <span>Your identity. Your privacy. Your control.</span>
    </div>
  );
}
