import {ExperienceBanner} from '../components/Experience'
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Layers3,
  CreditCard,
  CalendarClock,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/errors";
const money = (value) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    value / 100,
  );
const date = (value) => (value ? new Date(value).toLocaleString() : "—");
export default function Commerce() {
  const { pathname } = useLocation(),
    { user } = useAuth(),
    kind =
      pathname === "/promotions"
        ? "promotions"
        : pathname === "/subscriptions"
          ? "subscriptions"
          : "payments",
    [source, setSource] = useState("bank_point_orders"),
    [page, setPage] = useState(0),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    setPage(0);
    setRows([]);
    setError("");
  }, [kind, source]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    let query;
    if (kind === "promotions")
      query = supabase
        .from("promotions")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .order("created_at", { ascending: false });
    else if (kind === "subscriptions")
      query = supabase
        .from("subscriptions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("starts_at", { ascending: false });
    else
      query = supabase
        .from(source)
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
    withTimeout(query.range(page * 20, page * 20 + 19))
      .then(({ data, count, error }) => {
        if (!active) return;
        if (error) throw error;
        setRows(data || []);
        setTotal(count || 0);
      })
      .catch(() => {
        if (active) {
          setError("We could not load these records. Please try again.");
          setRows([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, source, page, user.id, version]);
  const labels = {
      promotions: [
        "PROMOTE WITH INTENTION",
        "A little more visibility.",
        "Explore the promotion packages currently offered by the platform.",
        Layers3,
      ],
      subscriptions: [
        "YOUR MEMBERSHIP RECORD",
        "Your plans, in one place.",
        "Review your recorded subscription status and dates.",
        CalendarClock,
      ],
      payments: [
        "EVERY TRANSACTION, ACCOUNTED FOR",
        "Your payment history.",
        "Manual bank transfers only. Credits require independent confirmation of received funds.",
        CreditCard,
      ],
    },
    [eyebrow, title, subtitle, Icon] = labels[kind];
  return (
    <main className="commerce-page">
      <div className="member-page-heading">
        <div>
          <p className="member-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <span className="member-page-icon">
          <Icon size={25} />
        </span>
      </div>
      <ExperienceBanner icon={Icon} title={kind==="payments"?"Clarity at every step.":kind==="promotions"?"Give your story a bigger stage.":"More room for your next chapter."} description="Your platform, your pace. Clear terms and real records, always."/>
      <nav className="commerce-tabs" aria-label="Commerce navigation">
        {[
          ["/promotions", "Promotions"],
          ["/subscriptions", "Subscriptions"],
          ["/payments", "Payments"],
          ["/boosts", "Boost Center"],
        ].map(([to, label]) => (
          <Link key={to} className={pathname === to ? "active" : ""} to={to}>
            {label}
          </Link>
        ))}
      </nav>
      {kind === "payments" && (
        <div className="commerce-history-tools">
          <div className="commerce-tabs compact">
            <button
              aria-pressed={source === "payment_transactions"}
              onClick={() => setSource("payment_transactions")}
            >
              Historical online payments (read-only)
            </button>
            <button
              aria-pressed={source === "bank_point_orders"}
              onClick={() => setSource("bank_point_orders")}
            >
              Manual bank deposits
            </button>
          </div>
          <button
            className="design-button secondary"
            disabled={loading}
            onClick={() => setVersion((v) => v + 1)}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      )}
      {error && (
        <p className="design-alert danger" role="alert">
          {error}
          <button onClick={() => setVersion((v) => v + 1)}>Retry</button>
        </p>
      )}
      {loading ? (
        <div className="design-empty" role="status">
          <span className="design-loader" />
          Loading your records…
        </div>
      ) : kind === "promotions" ? (
        <>
          <div className="design-alert">
            <ShieldCheck size={18} />
            <span>
              Promotion packages are arranged with the team. A displayed package
              does not automatically start a campaign or subscription. Confirm
              the scope before paying.
            </span>
          </div>
          {rows.length ? (
            <div className="commerce-package-grid">
              {rows.map((p) => (
                <article key={p.id}>
                  <span className="design-kicker">PROMOTION PACKAGE</span>
                  <h2>{p.title}</h2>
                  <p>
                    {p.description ||
                      "Contact the team for package scope and availability."}
                  </p>
                  <strong>
                    {p.price_kobo === null
                      ? "Contact the team"
                      : money(p.price_kobo)}
                  </strong>
                  <Link className="design-button secondary" to="/support">
                    Discuss this package <ArrowUpRight size={17} />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="design-empty">
              <Layers3 size={30} />
              <h2>No active packages right now</h2>
              <p>
                Your profile and regular discovery features remain available.
              </p>
              <Link to="/discover">
                Explore creators <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </>
      ) : (
        <section className="member-panel">
          <div className="member-panel-title">
            <div>
              <h2>
                {kind === "subscriptions"
                  ? "Your subscriptions"
                  : source === "bank_point_orders"
                    ? "Manual bank deposits"
                    : "Historical online transactions"}
              </h2>
              <p>{total} matching records · private to your account</p>
            </div>
          </div>
          <div className="member-table-wrap">
            <table>
              <thead>
                <tr>
                  {(kind === "subscriptions"
                    ? ["Plan", "Status", "Starts", "Expires"]
                    : [
                        "Reference / package",
                        "Amount",
                        "Status",
                        "Date",
                        "Action",
                      ]
                  ).map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) =>
                  kind === "subscriptions" ? (
                    <tr key={r.id}>
                      <td>{r.plan}</td>
                      <td>
                        <span className="design-status">
                          {r.expires_at && new Date(r.expires_at) < new Date()
                            ? "expired"
                            : r.status}
                        </span>
                      </td>
                      <td>{date(r.starts_at)}</td>
                      <td>{date(r.expires_at)}</td>
                    </tr>
                  ) : (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.reference || r.package_title}</strong>
                        {r.package_title && (
                          <small className="commerce-order-id">{r.id}</small>
                        )}
                      </td>
                      <td>{money(r.amount_kobo)}</td>
                      <td>
                        <span className={"design-status " + r.status}>
                          {r.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>{date(r.created_at)}</td>
                      <td>
                        {source === "bank_point_orders" &&
                          r.status === "awaiting_transfer" ? (
                          <Link to="/credits">View bank instructions →</Link>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="design-empty">
              <Icon size={29} />
              <h2>
                {kind === "subscriptions"
                  ? "No subscriptions recorded"
                  : "No payments recorded"}
              </h2>
              <p>
                {kind === "subscriptions"
                  ? "Any subscriptions assigned to this account will appear here."
                  : "Completed and pending purchases will appear here when available."}
              </p>
              <Link to="/rewards">Open my wallet →</Link>
            </div>
          )}
        </section>
      )}
      <div className="member-pagination">
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil(total / 20))}
        </span>
        <div>
          <button
            disabled={loading || page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            disabled={loading || (page + 1) * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
