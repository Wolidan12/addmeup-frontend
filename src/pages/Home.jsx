import LaunchPromotion from '../components/LaunchPromotion'
import {BrandScene} from '../components/Experience'
import { withTimeout } from "../lib/errors";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Link2,
  Globe2,
  Sparkles,
  Flame,
  Users,
  Compass,
  Check,
  Plus,
} from "lucide-react";
import { ProfileCard } from "../components/ui";
import PlatformLogo, { PLATFORM_LABELS } from "../components/PlatformLogo";
import { useSite } from "../context/SiteContext";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
export default function Home() {
  const site = useSite(),
    { user } = useAuth(),
    [creators, setCreators] = useState([]),
    [packages, setPackages] = useState([]),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [packageError, setPackageError] = useState(false);
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setLoading(false);
      setFailed(true);
      setPackageError(true);
      return;
    }
    withTimeout(
      Promise.all([
        supabase.rpc("public_directory", { p_page: 0 }),
        supabase
          .from("promotions")
          .select("*")
          .eq("is_active", true)
          .order("price_kobo")
          .limit(6),
      ]),
    )
      .then(([directory, promotions]) => {
        if (!active) return;
        setLoading(false);
        setFailed(!!directory.error);
        setPackageError(!!promotions.error);
        if (directory.data) setCreators(directory.data.rows.slice(0, 6));
        if (promotions.data) setPackages(promotions.data);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setPackageError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="landing-v2">
      <LaunchPromotion/>
      <section className="landing-hero landing-editorial">
        <div className="landing-hero-copy">
          <span className="design-kicker">
            <span />
            CONNECT. ENGAGE. GROW.
          </span>
          <h1>Your world.<br/>Better <em>connected.</em></h1><p className="landing-configured-title">{site.hero_title}</p>
          <p>{site.hero_description}</p>
          <div className="landing-hero-actions">
            <Link className="design-button primary" to="/register">
              Find your people <ArrowUpRight size={19} />
            </Link>
            <Link className="design-button secondary" to="/discover">
              Explore the community <ArrowRight size={17} />
            </Link>
          </div>
          <div className="landing-trust-row">
            <span>
              <Check size={14} /> Real people, real connections
            </span>
            <span>
              <ShieldCheck size={14} /> No social passwords
            </span>
          </div>
        </div>
        <BrandScene/>
      </section>
      {site.maintenance_mode && (
        <p className="design-alert landing-maintenance" role="status">
          We’re making improvements. Some member actions are temporarily paused.
        </p>
      )}
      <nav className="landing-wayfinder" aria-label="Explore Danqel"><a href="#community-preview">01 <span>Find your people</span><ArrowUpRight size={17}/></a><a href="#rewards-preview">02 <span>Build your momentum</span><ArrowUpRight size={17}/></a><a href="#packages-preview">03 <span>Expand your reach</span><ArrowUpRight size={17}/></a></nav><section className="landing-platform-strip">
        <span>ONE SPACE. YOUR FAVOURITE PLATFORMS.</span>
        <div>
          {site.enabled_platforms.map((p) => (
            <span key={p}>
              <PlatformLogo platform={p} size={23} />
              {PLATFORM_LABELS[p]}
            </span>
          ))}
        </div>
      </section>
      <section className="landing-section">
        <div className="landing-section-heading">
          <div>
            <span className="design-kicker">LESS NOISE. MORE POSSIBILITY.</span>
            <h2>
              A better kind of
              <br />
              <em>social connection.</em>
            </h2>
          </div>
          <p>
            You bring the personality. We bring a thoughtful space to share,
            discover and grow—without handing over your social accounts.
          </p>
        </div>
        <div className="landing-benefits">
          {[
            [
              Compass,
              "Find your corner",
              "Discover creators by platform, location and shared interests. Skip the noise and meet people who get you.",
            ],
            [
              Globe2,
              "Bring your world together",
              "One profile for your public social links. A photo, a story and a simple way to be discovered.",
            ],
            [
              ShieldCheck,
              "Stay in control",
              "Choose what’s public, manage your links and report unsafe profiles. Your social passwords are never required.",
            ],
          ].map(([Icon, t, d], i) => (
            <article key={t}>
              <div>
                <Icon size={25} />
                <span>0{i + 1}</span>
              </div>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-community" id="community-preview">
        <div className="landing-section-heading">
          <div>
            <span className="design-kicker">THE COMMUNITY</span>
            <h2>
              New faces.
              <br />
              <em>Genuine possibilities.</em>
            </h2>
          </div>
          <Link className="design-button secondary" to="/discover">
            Explore all creators <ArrowUpRight size={17} />
          </Link>
        </div>
        {loading ? (
          <div
            className="design-skeleton-grid"
            aria-label="Loading creators"
            role="status"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} />
            ))}
          </div>
        ) : failed ? (
          <div className="design-empty">
            <Compass size={30} />
            <h3>We couldn’t load creators just now.</h3>
            <p>Please try Explore again in a moment.</p>
            <Link to="/discover">Go to Explore →</Link>
          </div>
        ) : creators.length ? (
          <div className="landing-creator-grid">
            {creators.map((p) => (
              <ProfileCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="design-empty">
            <Users size={32} />
            <h3>A community starts with someone like you.</h3>
            <p>
              Create your profile and be one of the first to make a connection.
            </p>
            <Link className="design-button primary" to="/register">
              Create my profile <Plus size={16} />
            </Link>
          </div>
        )}
      </section>
      <section className="landing-section landing-rewards" id="rewards-preview">
        <div>
          <span className="design-kicker">A LITTLE MOMENTUM, EVERY DAY</span>
          <h2>
            Show up.
            <br />
            Connect.
            <br />
            <em>Go further.</em>
          </h2>
          <p>
            Build your presence with eligible daily rewards. Invite your
            friends, keep a check-in streak and explore capped point boosters
            when plans are available.
          </p>
          <Link className="design-button primary" to="/rewards">
            Discover rewards <ArrowUpRight size={17} />
          </Link>
          <small>
            Points have no cash value. Eligibility, plan cost and reward limits
            apply.
          </small>
        </div>
        <div className="landing-reward-stack">
          {[
            [
              Flame,
              "Make today count",
              "Claim an eligible daily check-in and build your streak.",
            ],
            [
              Users,
              "Better, together",
              "Share a personal invitation. Eligible approved point purchases can earn referral points.",
            ],
            [
              Sparkles,
              "A considered boost",
              "Choose an available plan to multiply eligible daily and task rewards within its bonus cap.",
            ],
          ].map(([Icon, t, d], i) => (
            <article key={t}>
              <span className="reward-stack-icon">
                <Icon size={23} />
              </span>
              <div>
                <span>0{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-community landing-packages" id="packages-preview">
        <div className="landing-section-heading">
          <div>
            <span className="design-kicker">CREATE YOUR NEXT CHAPTER</span>
            <h2>
              A little more
              <br />
              <em>room to be seen.</em>
            </h2>
          </div>
          <p>
            Browse the promotion packages currently offered by the platform.
            Contact the team to confirm scope, availability and arrangements
            before paying.
          </p>
        </div>
        {packages.length ? (
          <div className="landing-package-grid">
            {packages.map((p) => (
              <article key={p.id}>
                <span className="design-kicker">PROMOTION PACKAGE</span>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <strong>
                  {p.price_kobo === null
                    ? "Contact the team"
                    : new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                      }).format(p.price_kobo / 100)}
                </strong>
                <Link className="design-button secondary" to="/support">
                  Ask about this package <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="design-empty">
            <Sparkles size={28} />
            <h3>
              {packageError
                ? "Packages are temporarily unavailable."
                : "New opportunities are on the way."}
            </h3>
            <p>
              {packageError
                ? "Please try again later or contact support."
                : "No promotion packages are currently offered. You can still create and share your profile."}
            </p>
          </div>
        )}
      </section>
      <section className="landing-final">
        <span className="design-kicker">YOUR NEXT CONNECTION STARTS HERE</span>
        <h2>
          Make space for
          <br />
          <em>something good.</em>
        </h2>
        <Link className="design-button primary" to="/register">
          Join Danqel Social Boost <ArrowUpRight size={19} />
        </Link>
        <p>Human connections. No artificial engagement.</p>
      </section>
    </main>
  );
}
