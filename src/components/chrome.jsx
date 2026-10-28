import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight, Menu, X, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
export function Navbar() {
  const { user } = useAuth(),
    site = useSite(),
    [open, setOpen] = useState(false);
  return (
    <header className="public-nav">
      <div className="public-nav-inner">
        <Link to="/" className="design-brand">
          <span className="design-brand-mark">d.</span>
          <span>
            {site.brand_name}
            <small>CONNECTIONS THAT GO FURTHER</small>
          </span>
        </Link>
        <button
          className="public-menu-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav
          className={open ? "public-links open" : "public-links"}
          aria-label="Main navigation"
        >
          <NavLink onClick={() => setOpen(false)} to="/discover">
            Discover
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/rewards">
            Rewards
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/promotions">
            Promotions
          </NavLink>
          <Link onClick={() => setOpen(false)} to="/support">
            Support
          </Link>
          <span className="public-nav-separator" />
          {user ? (
            <Link className="design-button primary" to="/dashboard">
              My workspace <ArrowUpRight size={16} />
            </Link>
          ) : (
            <>
              <Link className="public-login" to="/login">
                Sign in
              </Link>
              <Link className="design-button primary" to="/register">
                Get connected <ArrowUpRight size={16} />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
export function Footer() {
  const site = useSite();
  return (
    <footer className="public-footer">
      <div className="public-footer-top">
        <div>
          <Link className="design-brand" to="/">
            <span className="design-brand-mark">d.</span>
            {site.brand_name}
          </Link>
          <p>
            More than a link. A world of possibility.
            <br />
            Connect thoughtfully. Grow authentically.
          </p>
          <span className="footer-trust">
            <ShieldCheck size={15} /> Your social passwords stay private.
          </span>
        </div>
        <nav aria-label="Community">
          <h2>Your community</h2>
          <Link to="/discover">Discover creators</Link>
          <Link to="/dashboard">Your workspace</Link>
          <Link to="/referrals">Invite friends</Link>
          <Link to="/boosts">Point boosters</Link>
        </nav>
        <nav aria-label="Help and policies">
          <h2>Here for you</h2>
          <Link to="/support">Help & support</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of service</Link>
          <Link to="/cookies">Cookies & storage</Link>
          <Link to="/delete-account">Account deletion</Link>
        </nav>
      </div>
      <div className="public-footer-bottom">
        <span>
          © {new Date().getFullYear()} {site.brand_name}
        </span>
        <span>Built for real people. Not artificial engagement.</span>
        <Link to="/admin/login">Staff sign in ↗</Link>
      </div>
    </footer>
  );
}
