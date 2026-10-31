import NotificationPreferences from '../components/NotificationPreferences'
import { Link } from "react-router-dom";
import { Bell, Trophy, Flame, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useMember } from "../member/MemberContext";
import NotificationInbox from "../components/NotificationInbox";
import { ExperienceBanner, EmptyState } from "../components/Experience";
export default function ActivityCenter({ rankings = false }) {
  const { data, refresh } = useMember();
  return (
    <main className="activity-center">
      <div className="member-page-heading">
        <div>
          <p className="member-eyebrow">
            {rankings ? "PROGRESS WITH PURPOSE" : "STAY IN THE LOOP"}
          </p>
          <h1>{rankings ? "Rewards & leaderboard." : "Your notifications."}</h1>
          <p>
            {rankings
              ? "Celebrate genuine participation. Every point has a story."
              : "The updates that matter, without the noise."}
          </p>
        </div>
        {rankings ? <Trophy size={28} /> : <Bell size={28} />}
      </div>
      <ExperienceBanner
        icon={rankings ? Trophy : Bell}
        title={rankings ? "Show up. Level up." : "Good things. All caught up."}
        description={
          rankings
            ? "Build your own momentum through eligible missions, consistent check-ins and meaningful referrals."
            : "Account updates, moderation messages and payment decisions, together in your private inbox."
        }
      />
      {rankings ? (
        <>
          <section className="member-stats member-referral-stats">
            <article>
              <div>
                <span>Your available points</span>
                <Trophy size={19} />
              </div>
              <strong>
                {data ? Number(data.balance.balance).toLocaleString() : "—"}
              </strong>
              <small>Private account balance · not a public ranking</small>
            </article>
            <article>
              <div>
                <span>Your current streak</span>
                <Flame size={19} />
              </div>
              <strong>
                {data ? data.balance.current_streak : "—"} <small>days</small>
              </strong>
              <small>One eligible check-in at a time</small>
            </article>
            <article>
              <div>
                <span>Your referral rewards</span>
                <ShieldCheck size={19} />
              </div>
              <strong>
                {data ? Number(data.referral_earnings).toLocaleString() : "—"}{" "}
                <small>DC</small>
              </strong>
              <small>Credited, database-recorded rewards</small>
            </article>
          </section>
          <div className="premium-destination-grid">
            <Link to="/missions">
              <span>01 / PARTICIPATE</span>
              <h2>Make your next move.</h2>
              <p>Explore your eligible missions.</p>
              <ArrowUpRight />
            </Link>
            <Link to="/wallet">
              <span>02 / YOUR PROGRESS</span>
              <h2>Every point, accounted for.</h2>
              <p>See your growth wallet and ledger.</p>
              <ArrowUpRight />
            </Link>
          </div>
          <EmptyState
            icon={Trophy}
            title="Public rankings are not published."
            description="There is no configured public leaderboard yet. We do not invent standings or expose other members’ private balances."
          />
        </>
      ) : (
        <><NotificationInbox onRead={refresh} /><NotificationPreferences/></>
      )}
    </main>
  );
}
