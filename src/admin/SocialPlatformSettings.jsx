import { useState } from "react";
import { useSite } from "../context/SiteContext";
import { PLATFORMS } from "../lib/validation";
import { InputError, publicError, withTimeout } from "../lib/errors";
import { supabase } from "../lib/supabase";
const empty = { key: "", label: "", hosts: "", enabled: true, reason: "" };
export default function SocialPlatformSettings() {
  const site = useSite(),
    [form, setForm] = useState(empty),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  function choose(key) {
    const p = site.platforms.find((p) => p.key === key);
    setForm(
      p
        ? {
            key: p.key,
            label: p.label,
            hosts: p.hosts.join(", "),
            enabled: site.enabled_platforms.includes(key),
            reason: "",
          }
        : empty,
    );
    setError("");
    setMessage("");
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const hosts = form.hosts
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      if (
        !/^[a-z][a-z0-9_]{0,29}$/.test(form.key) ||
        PLATFORMS.includes(form.key)
      )
        throw new InputError(
          "Choose a custom platform key: lowercase letters, numbers or underscores, starting with a letter.",
        );
      if (
        !hosts.length ||
        hosts.length > 10 ||
        hosts.some((h) => !/^([a-z0-9]+[a-z0-9-]*\.)+[a-z]{2,63}$/.test(h))
      )
        throw new InputError(
          "Enter up to ten public hostnames separated by commas, without protocol, path or port.",
        );
      const { error } = await withTimeout(
        supabase.rpc("admin_save_social_platform", {
          p_key: form.key,
          p_label: form.label.trim(),
          p_hosts: [...new Set(hosts)],
          p_enabled: form.enabled,
          p_reason: form.reason,
        }),
      );
      if (error) throw error;
      await site.refresh();
      setMessage(
        "Platform configuration saved and audit-logged. Existing links are never marked ownership-verified.",
      );
      setForm(empty);
    } catch (e) {
      setError(
        publicError(
          e,
          "We could not save this platform. Check the fields and public hostnames, then retry.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ad-panel account-platform-settings">
      <div className="ad-panel-heading">
        <div>
          <h2>Custom social platforms</h2>
          <p>
            Super Admin only. Allowlist exact public hosts; never request a
            creator’s platform password.
          </p>
        </div>
      </div>
      <form onSubmit={save}>
        <label>
          Edit a custom platform
          <select
            value={
              site.platforms.some((p) => p.key === form.key) &&
              !PLATFORMS.includes(form.key)
                ? form.key
                : ""
            }
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">Add a new platform</option>
            {site.platforms
              .filter((p) => !PLATFORMS.includes(p.key))
              .map((p) => (
                <option value={p.key} key={p.key}>
                  {p.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Platform key
          <input
            required
            pattern="[a-z][a-z0-9_]{0,29}"
            maxLength={30}
            value={form.key}
            onChange={(e) =>
              setForm((f) => ({ ...f, key: e.target.value.toLowerCase() }))
            }
          />
        </label>
        <label>
          Platform name
          <input
            required
            maxLength={40}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </label>
        <label>
          Allowed hosts (comma separated)
          <input
            required
            maxLength={1000}
            placeholder="example.com, creator.example.com"
            value={form.hosts}
            onChange={(e) => setForm((f) => ({ ...f, hosts: e.target.value }))}
          />
        </label>
        <label className="member-check">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, enabled: e.target.checked }))
            }
          />
          Enabled for member links and discovery
        </label>
        <label>
          Reason
          <textarea
            required
            minLength={8}
            maxLength={1000}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </label>
        <button className="ad-primary" disabled={busy}>
          {busy ? "Saving…" : "Save platform configuration"}
        </button>
        {error && (
          <p role="alert" className="ad-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="ad-notice">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
