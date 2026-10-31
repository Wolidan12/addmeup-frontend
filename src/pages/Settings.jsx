import { ExperienceBanner } from "../components/Experience";
import WorkspaceNav from "../components/WorkspaceNav";
import { InputError, publicError, withTimeout } from "../lib/errors";
import { profileDetails, profileCompletion } from "../lib/accountValidation";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, UserRound, Link2, Trash2 } from "lucide-react";
import ProfilePhoto from "../components/ProfilePhoto";
import NotificationInbox from "../components/NotificationInbox";
import PlatformLogo, { PLATFORM_LABELS } from "../components/PlatformLogo";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
import { useMember } from "../member/MemberContext";
import { supabase } from "../lib/supabase";
import { validSocialUrl, socialHref } from "../lib/validation";
const initial = {
  display_name: "",
  username: "",
  bio: "",
  country: "",
  location: "",
  categories: "",
  interests: "",
  is_public: false,
  avatar_url: "",
};
export default function Settings() {
  const { user } = useAuth(),
    site = useSite(),
    { data, refresh } = useMember();
  const [form, setForm] = useState(initial),
    [links, setLinks] = useState([]),
    [platform, setPlatform] = useState(site.enabled_platforms[0] || ""),
    [url, setUrl] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [remove, setRemove] = useState(null);
  const hydrated = useRef(null),
    dialog = useRef(null),
    generation = useRef(0);
  const label = (p) =>
    site.platforms?.find((x) => x.key === p)?.label || PLATFORM_LABELS[p] || p;
  useEffect(() => {
    if (data?.profile?.id === user.id && hydrated.current !== user.id) {
      const p = data.profile;
      setForm({
        ...initial,
        ...p,
        interests: (p.interests || []).join(", "),
        categories: (p.categories || []).join(", "),
      });
      hydrated.current = user.id;
    }
  }, [data, user.id]);
  useEffect(() => {
    let active = true;
    setLinks([]);
    setMessage("");
    setError("");
    withTimeout(
      supabase
        .from("social_links")
        .select("*")
        .eq("profile_id", user.id)
        .order("platform"),
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setError("Could not load your social links. Refresh to retry.");
        else setLinks(data || []);
      })
      .catch(() => {
        if (active)
          setError("We could not load your social links. Refresh to retry.");
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [user.id]);
  useEffect(() => {
    const current = links.find((l) => l.platform === platform);
    setUrl(current?.url || "");
    setVisible(current?.is_public ?? false);
  }, [platform, links]);
  useEffect(() => {
    if (remove) dialog.current?.showModal();
  }, [remove]);
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    const request = generation.current;
    try {
      const permitted = profileDetails(form);
      const { data, error } = await withTimeout(
        supabase
          .from("profiles")
          .update(permitted)
          .eq("id", user.id)
          .select("id"),
      );
      if (error) {
        if (error.code === "23505")
          throw new InputError(
            "That username is already taken. Choose another.",
          );
        throw error;
      }
      if (!data?.length)
        throw new InputError(
          "Your profile could not be updated. Refresh and try again.",
        );
      if (request === generation.current)
        setMessage("Your profile has been updated.");
      await refresh();
    } catch (e) {
      if (request === generation.current) setError(publicError(e));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  async function social(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    const request = generation.current;
    try {
      const value = url.trim();
      if (
        !site.enabled_platforms.includes(platform) ||
        !validSocialUrl(platform, value, site.platforms)
      )
        throw new InputError(
          `Use a valid official ${label(platform)} profile URL${platform === "whatsapp" ? " or international phone number" : ""}.`,
        );
      const normalized = socialHref(platform, value);
      const { data, error } = await withTimeout(
        supabase
          .from("social_links")
          .upsert(
            {
              profile_id: user.id,
              platform,
              url: normalized,
              is_public: visible,
            },
            { onConflict: "profile_id,platform" },
          )
          .select("*")
          .single(),
      );
      if (error) throw error;
      if (request === generation.current) {
        setLinks((old) => [
          ...old.filter((l) => l.platform !== platform),
          data,
        ]);
        setMessage(
          "Social link saved. Link format checked; platform ownership is not verified.",
        );
      }
      await refresh();
    } catch (e) {
      if (request === generation.current) setError(publicError(e));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  async function removeLink() {
    if (!remove || busy) return;
    setBusy(true);
    setError("");
    const request = generation.current;
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("social_links")
          .delete()
          .eq("id", remove.id)
          .eq("profile_id", user.id)
          .select("id"),
      );
      if (error) throw error;
      if (!data?.length)
        throw new InputError(
          "This link is no longer available. Refresh your profile.",
        );
      if (request === generation.current) {
        setLinks((old) => old.filter((l) => l.id !== remove.id));
        setRemove(null);
        setMessage("Social link removed.");
      }
      await refresh();
    } catch (e) {
      if (request === generation.current) setError(publicError(e));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  return (
    <main>
      <WorkspaceNav community />
      <div className="member-page-heading">
        <div>
          <p className="member-eyebrow">YOUR STORY. YOUR COMMUNITY.</p>
          <h1>Make it yours.</h1>
          <p>Build a profile that feels like you. Choose what you share.</p>
        </div>
        {data?.profile && (
          <Link
            className="member-primary"
            to={"/profile/" + data.profile.username}
          >
            Preview profile <ArrowUpRight size={15} />
          </Link>
        )}
      </div>
      <ExperienceBanner
        title="A profile that feels like you."
        description="Your portrait, your story, your social world. Make it unmistakably yours."
      />
      <section
        className="account-progress member-panel"
        aria-label="Your account progress"
      >
        <div>
          <span>Creator XP</span>
          <strong>
            {Number(data?.profile?.creator_xp || 0).toLocaleString()}
          </strong>
          <small>Non-spendable mission XP, never purchased</small>
        </div>
        <div>
          <span>Creator rank</span>
          <strong>{data?.profile?.creator_rank || "View missions"}</strong>
          <small>Starter → Rising Creator → Influencer → Trendsetter → Elite Creator</small>
        </div>
        <div>
          <span>Growth Credits</span>
          <strong>
            {data?.balance?.balance!=null ? Number(data.balance.balance).toLocaleString() : "—"}
          </strong>
          <small>Private balance · not editable here</small>
        </div>
        <div>
          <span>Profile strength</span>
          <strong>{profileCompletion(data?.profile, links.length)}%</strong>
          <progress
            aria-label="Profile strength"
            value={profileCompletion(data?.profile, links.length)}
            max="100"
          />
        </div>
        <p>
          Member since{" "}
          {data?.profile?.created_at
            ? new Date(data.profile.created_at).toLocaleDateString()
            : "—"}
          . This optional strength score includes a social link. Launch eligibility uses name, username, photo, bio, country and interests; linking a social account is not required for launch.
        </p>
      </section>
      <ProfilePhoto
        current={form.avatar_url}
        onSaved={(avatar_url) => {
          setForm((f) => ({ ...f, avatar_url }));
          refresh();
        }}
      />
      <section className="member-panel member-settings-panel">
        <div className="member-panel-title">
          <div>
            <h2>Profile details</h2>
            <p>
              Your email stays private. Public profile details are visible to
              the community.
            </p>
          </div>
          <UserRound size={20} />
        </div>
        <form onSubmit={save} className="member-settings-form">
          <label>
            Display name
            <input
              required
              minLength={1}
              maxLength={60}
              value={form.display_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, display_name: e.target.value }))
              }
            />
          </label>
          <label>
            Username
            <input
              required
              pattern="[a-z0-9_]{3,24}"
              maxLength={24}
              autoComplete="username"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  username: e.target.value.toLowerCase(),
                }))
              }
            />
          </label>
          <label className="member-full-width">
            Bio
            <textarea
              aria-label="Bio"
              maxLength={280}
              rows={3}
              value={form.bio || ""}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </label>
          <label>
            Country
            <input
              maxLength={80}
              value={form.country || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, country: e.target.value }))
              }
            />
          </label>
          <label>
            Location (optional)
            <input
              maxLength={100}
              value={form.location || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />
          </label>
          <label>
            Interests (comma separated)
            <input
              value={form.interests}
              maxLength={409}
              onChange={(e) =>
                setForm((f) => ({ ...f, interests: e.target.value }))
              }
            />
          </label>
          <label>
            Categories (comma separated)
            <input
              value={form.categories}
              maxLength={204}
              onChange={(e) =>
                setForm((f) => ({ ...f, categories: e.target.value }))
              }
            />
          </label>
          <label className="member-check member-full-width">
            <input
              className="w-auto"
              type="checkbox"
              checked={form.is_public}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_public: e.target.checked }))
              }
            />
            Show my profile in the public community directory
          </label>
          <div className="member-full-width">
            <button
              className="member-primary"
              disabled={busy || !data || data.restricted}
            >
              {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </section>
      <section className="member-panel member-settings-panel mt-6">
        <div className="member-panel-title">
          <div>
            <h2>Your social connections</h2>
            <p>
              Link format is validated. Ownership verification is not connected;
              no unearned verification badges are shown.
            </p>
          </div>
          <Link2 size={20} />
        </div>
        <div className="member-settings-form">
          <div className="directory-platforms member-full-width">
            {site.enabled_platforms.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={platform === p}
                className={platform === p ? "selected" : ""}
                onClick={() => setPlatform(p)}
              >
                <PlatformLogo platform={p} />
                {label(p)}
                {links.some((l) => l.platform === p) && " ✓"}
              </button>
            ))}
          </div>
          {site.enabled_platforms.includes(platform) ? (
            <form className="member-full-width space-y-4" onSubmit={social}>
              <label>
                {label(platform)}{" "}
                {platform === "whatsapp"
                  ? "phone number or wa.me URL"
                  : "profile URL"}
                <input
                  required
                  type="text"
                  value={url}
                  maxLength={500}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <label className="member-check">
                <input
                  className="w-auto"
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                />
                Make this link public
              </label>
              <button
                className="member-primary"
                disabled={busy || !data || data.restricted}
              >
                {busy ? "Saving…" : "Save social link"}
              </button>
            </form>
          ) : (
            <p>No social platform is currently selected or available.</p>
          )}
          <ul className="account-links member-full-width">
            {links.map((link) => (
              <li key={link.id}>
                <div>
                  <strong>{label(link.platform)}</strong>
                  <small>
                    {link.is_public ? "Public link" : "Private link"}
                    {!site.enabled_platforms.includes(link.platform)
                      ? " · platform currently disabled"
                      : ""}
                  </small>
                  {validSocialUrl(link.platform, link.url, site.platforms) ? (
                    <a
                      href={socialHref(link.platform, link.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      Open profile <ArrowUpRight size={14} />
                    </a>
                  ) : (
                    <span>Link needs updating</span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    className="btn2"
                    disabled={
                      busy || !site.enabled_platforms.includes(link.platform)
                    }
                    onClick={() => setPlatform(link.platform)}
                  >
                    Edit {label(link.platform)}
                  </button>
                  <button
                    type="button"
                    className="btn2"
                    disabled={busy || data?.restricted}
                    onClick={() => setRemove(link)}
                    aria-label={"Remove " + label(link.platform)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {remove && (
        <dialog
          className="member-dialog"
          ref={dialog}
          aria-labelledby="remove-social-title"
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setRemove(null);
          }}
        >
          <h2 id="remove-social-title">Remove {label(remove.platform)}?</h2>
          <p>
            This removes the link from Danqel, not your account on that
            platform.
          </p>
          {error && (
            <p role="alert" className="member-error">
              {error}
            </p>
          )}
          <div className="member-dialog-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="member-primary"
              disabled={busy}
              onClick={removeLink}
            >
              {busy ? "Removing…" : "Confirm removal"}
            </button>
          </div>
        </dialog>
      )}
      {message && (
        <p role="status" className="member-notice mt-5">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="member-error mt-5">
          {error}
        </p>
      )}
      <NotificationInbox onRead={refresh} />
      <p className="text-xs text-slate-500 mt-5">
        Signed in as {user.email}.{" "}
        <Link className="underline" to="/delete-account">
          Account deletion information
        </Link>
      </p>
    </main>
  );
}
