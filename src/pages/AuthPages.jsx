import { useEffect, useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  CheckCircle2,
  Users,
  Globe2,
  LockKeyhole,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
import { supabase } from "../lib/supabase";
import { publicError, withTimeout } from "../lib/errors";
import { loginDestination } from "../lib/navigation";
function Shell({
  eyebrow = "YOUR WORLD, BETTER CONNECTED",
  title,
  subtitle,
  children,
  staff = false,
}) {
  const site = useSite();
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link className="design-brand" to="/">
          <span className="design-brand-mark">d.</span>
          {site.brand_name}
        </Link>
        <div className="auth-story-main">
          <span className="design-kicker">
            <span />
            {staff
              ? "BUILT ON ACCOUNTABILITY"
              : "GOOD PEOPLE. GREATER POSSIBILITIES."}
          </span>
          <h2>
            {staff ? (
              <>
                A trusted space.
                <br />
                <em>
                  For the people
                  <br />
                  behind it.
                </em>
              </>
            ) : (
              <>
                Not just a profile.
                <br />
                <em>
                  Your next
                  <br />
                  possibility.
                </em>
              </>
            )}
          </h2>
          <p>
            {staff
              ? "Manage your community with clear permissions, considered decisions and an accountable record of every sensitive action."
              : "Bring your social world together. Meet creators, find your community and turn everyday connections into something more."}
          </p>
          <div className="auth-constellation" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>
              <Users size={35} />
            </span>
            <b>
              <Globe2 size={25} />
            </b>
            <small>
              <ShieldCheck size={22} />
            </small>
          </div>
        </div>
        <p className="auth-trust">
          <ShieldCheck size={16} /> Your social passwords stay yours. Always.
        </p>
      </section>
      <section className="auth-form-panel">
        <Link className="auth-back" to="/">
          <ArrowLeft size={15} />
          Back to Danqel
        </Link>
        <div className="auth-form-content">
          <div className="auth-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
        <div className="auth-footer">
          <Link to="/privacy">Privacy</Link>
          <span>·</span>
          <Link to="/terms">Terms</Link>
          <span>·</span>
          <Link to="/support">Need help?</Link>
        </div>
      </section>
    </main>
  );
}
const Notice = ({ error, message }) =>
  error ? (
    <p className="design-alert danger" role="alert">
      {error}
    </p>
  ) : message ? (
    <p className="design-alert success" role="status">
      {message}
    </p>
  ) : null;
function Password({
  label = "Password",
  name = "password",
  newPassword = false,
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="auth-field">
      {label}
      <span className="auth-password">
        <input
          name={name}
          type={show ? "text" : "password"}
          minLength={newPassword ? 8 : undefined}
          required
          autoComplete={newPassword ? "new-password" : "current-password"}
        />
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
export function Login({ staff = false }) {
  const { signIn, user, loading, sessionError, retrySession, signOut } =
      useAuth(),
    n = useNavigate(),
    location = useLocation(),
    destination = loginDestination(
      location.state?.from || (staff ? "/admin" : "/dashboard"),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  // Staff sign-in stays available for switching a signed-in ordinary account.
  if (!loading && user && !staff) return <Navigate to={destination} replace />;
  return (
    <Shell
      staff={staff}
      eyebrow={staff ? "AUTHORIZED STAFF ONLY" : "WELCOME BACK"}
      title={staff ? "Staff sign in." : "Your people await."}
      subtitle={
        staff
          ? "Use your existing account. Staff permissions are verified separately."
          : "Sign in to pick up where you left off."
      }
    >
      <Notice error={error || sessionError} />
      {sessionError && (
        <button className="auth-text-button" onClick={retrySession}>
          Retry session
        </button>
      )}
      {staff && user ? (
        <div className="auth-existing">
          <ShieldCheck size={22} />
          <p>
            You’re already signed in. You can check staff access or switch
            accounts.
          </p>
          <Link className="design-button primary" to="/admin">
            Open staff workspace <ArrowUpRight size={17} />
          </Link>
          <button
            className="auth-text-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signOut();
              } catch {
                setError("We could not sign you out. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out and use another account
          </button>
        </div>
      ) : (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const { error } = await signIn(f.get("email"), f.get("password"));
              if (error) throw error;
              n(destination, { replace: true });
            } catch (e) {
              setError(
                publicError(
                  e,
                  "We could not sign you in. Please check your details and try again.",
                ),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="auth-field">
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <Password />
          <Link className="auth-forgot" to="/forgot-password">
            Forgot password?
          </Link>
          <button className="design-button primary" disabled={busy}>
            {busy
              ? "Signing in…"
              : staff
                ? "Continue to staff workspace"
                : "Sign in"}
            <ArrowUpRight size={17} />
          </button>
        </form>
      )}
      <p className="auth-switch">
        {staff ? (
          <Link to="/login">Looking for your member account? Sign in here</Link>
        ) : (
          <>
            New around here? <Link to="/register">Create an account</Link>
          </>
        )}
      </p>
      {!staff && (
        <Link className="auth-staff-link" to="/admin/login">
          <LockKeyhole size={13} /> Staff sign in
        </Link>
      )}
    </Shell>
  );
}
export function Register() {
  const { signUp } = useAuth(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Shell
      eyebrow="A NEW CHAPTER STARTS HERE"
      title="Make room for more."
      subtitle="One account. Your social world, connected."
    >
      <Notice error={error} message={message} />
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const { error } = await signUp(f.get("email"), f.get("password"));
            if (error) throw error;
            setMessage(
              "Check your email for a verification link. If an account already exists, you can sign in or reset your password.",
            );
          } catch (e) {
            setError(
              publicError(
                e,
                "We could not create your account. Please try again.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="auth-field">
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <Password label="Create a password" newPassword />
        <p className="auth-password-hint">
          At least 8 characters. Use a password you don’t use elsewhere.
        </p>
        <label className="auth-consent">
          <input type="checkbox" required />{" "}
          <span>
            I agree to the <Link to="/terms">Terms</Link> and{" "}
            <Link to="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <button className="design-button primary" disabled={busy}>
          {busy ? "Creating your account…" : "Create my account"}
          <ArrowUpRight size={17} />
        </button>
      </form>
      <p className="auth-switch">
        Already part of the community? <Link to="/login">Sign in</Link>
      </p>
    </Shell>
  );
}
export function Forgot() {
  const { reset } = useAuth(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Shell
      eyebrow="LET’S GET YOU BACK IN"
      title="A fresh start."
      subtitle="Enter your email and we’ll send you a password-reset link."
    >
      <Notice error={error} message={message} />
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { error } = await reset(
              new FormData(e.currentTarget).get("email"),
            );
            if (error) throw error;
            setMessage(
              "If an account exists for that address, a reset link has been sent.",
            );
          } catch (e) {
            setError(
              publicError(
                e,
                "We could not send a reset link. Please try again.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="auth-field">
          Email address
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <button className="design-button primary" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
          <Mail size={17} />
        </button>
      </form>
      <Link className="auth-switch" to="/login">
        Return to sign in
      </Link>
    </Shell>
  );
}
export function Reset() {
  const { loading, user } = useAuth(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Shell
      eyebrow="YOUR ACCOUNT. YOUR CONTROL."
      title="Choose a new password."
      subtitle="Open this page using the reset link sent to your email."
    >
      <Notice error={error} message={message} />
      {!loading && !user ? (
        <p className="auth-switch">
          No valid reset session.{" "}
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      ) : (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              if (f.get("password") !== f.get("confirm"))
                throw { code: "password_mismatch" };
              const { error } = await withTimeout(
                supabase.auth.updateUser({ password: f.get("password") }),
              );
              if (error) throw error;
              setMessage(
                "Your password has been updated. You can continue to your account.",
              );
            } catch (e) {
              setError(
                e.code === "password_mismatch"
                  ? "The passwords do not match."
                  : publicError(
                      e,
                      "We could not update your password. Request a new reset link and try again.",
                    ),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Password label="New password" newPassword />
          <Password label="Confirm new password" name="confirm" newPassword />
          <button className="design-button primary" disabled={busy || loading}>
            {busy ? "Updating…" : "Update password"}
            <ShieldCheck size={17} />
          </button>
        </form>
      )}
      {message && (
        <Link className="auth-switch" to="/dashboard">
          Continue to my account →
        </Link>
      )}
    </Shell>
  );
}
export function Verify() {
  const { user, loading } = useAuth(),
    [verified, setVerified] = useState(false),
    [checking, setChecking] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user || !supabase) {
      setVerified(false);
      return;
    }
    setChecking(true);
    withTimeout(supabase.auth.getUser())
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setError(
            "We could not verify this link. Please request a new email.",
          );
        else setVerified(!!data.user?.email_confirmed_at);
      })
      .catch(() => {
        if (active)
          setError("We could not verify this link. Please try again.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <Shell
      eyebrow="ONE LAST CONNECTION"
      title={verified ? "You’re verified." : "Check your inbox."}
      subtitle={
        verified
          ? "Your account is ready. Make your profile yours."
          : "Open the verification link we sent to your email. If it has expired, request another below."
      }
    >
      <Notice error={error} message={message} />
      {loading || checking ? (
        <p role="status">Checking verification…</p>
      ) : verified ? (
        <Link className="design-button primary" to="/dashboard">
          <CheckCircle2 size={17} />
          Continue to my account
        </Link>
      ) : (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (!supabase) throw new Error();
              const { error } = await withTimeout(
                supabase.auth.resend({
                  type: "signup",
                  email: new FormData(e.currentTarget).get("email"),
                  options: {
                    emailRedirectTo: window.location.origin + "/verify",
                  },
                }),
              );
              if (error) throw error;
              setMessage(
                "If verification is needed for that address, a new link will be sent.",
              );
            } catch (e) {
              setError(
                publicError(
                  e,
                  "We could not send a verification email. Please try again.",
                ),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="auth-field">
            Email address
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <button className="design-button primary" disabled={busy}>
            {busy ? "Sending…" : "Resend verification email"}
            <Mail size={17} />
          </button>
        </form>
      )}
      <Link className="auth-switch" to="/login">
        Back to sign in
      </Link>
    </Shell>
  );
}
