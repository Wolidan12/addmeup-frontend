import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, ShieldCheck } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { withTimeout, publicError } from '../lib/errors'

export default function LaunchPromotion({ compact = false, onAward }) {
  const { user } = useAuth()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    if (!isSupabaseConfigured) {
      setError('Campaign availability is temporarily unavailable.')
      return () => { current = false }
    }

    async function load() {
      try {
        const { data, error } = await withTimeout(supabase.rpc('launch_status'))
        if (error) throw error
        if (!data || !Number.isInteger(data.remaining_slots) || !data.eligibility) {
          throw new Error('Invalid campaign response')
        }
        if (current) {
          setStatus(data)
          setError('')
        }
      } catch {
        if (current) {
          setStatus(null)
          setError('Campaign availability is temporarily unavailable.')
        }
      }
    }

    load()
    const timer = setInterval(load, 30000)
    return () => {
      current = false
      clearInterval(timer)
    }
  }, [user?.id, version])

  async function check() {
    setBusy(true)
    setError('')
    try {
      const { data, error } = await withTimeout(supabase.rpc('claim_launch_reward'))
      if (error) throw error
      if (!data || !Number.isInteger(data.remaining_slots) || !data.eligibility) {
        throw new Error('Invalid campaign response')
      }
      setStatus(data)
      if (data.award) onAward?.()
    } catch (e) {
      setError(publicError(e, 'We could not check your launch reward. Please retry.'))
    } finally {
      setBusy(false)
    }
  }

  const slots = status?.remaining_slots
  const title = status?.status === 'completed'
    ? 'Launch rewards fully awarded.'
    : status?.status === 'paused'
      ? 'Launch promotion temporarily paused.'
      : 'Start your growth with 5,000 DC.'

  return (
    <section className={`launch-promotion ${compact ? 'compact' : ''}`} aria-label="Official launch promotion">
      <div className="launch-promotion-heading">
        <span><Gift size={23} /></span>
        <div>
          <p className="member-eyebrow">OFFICIAL LAUNCH / FIRST 50 ELIGIBLE ACCOUNTS</p>
          <h2>{title}</h2>
        </div>
      </div>

      <p>Verify your email and complete the required profile fields. The first 50 successful eligible awards receive 5,000 DC automatically; registration alone does not reserve a slot.</p>
      <div className="launch-live" aria-live="polite">
        <strong>{status ? `${slots} ${slots === 1 ? 'slot' : 'slots'} remaining` : 'Availability not loaded'}</strong>
        <span>{status ? `${Number(status.total_distributed_dc).toLocaleString()} DC awarded · ${status.status}` : 'Live successful-award count only — no estimated counter.'}</span>
      </div>
      <p className="launch-requirements">Required profile: display name, username, photo, bio, country and at least one interest. No social-account link is required for this promotion.</p>
      <p className="launch-guarantee"><ShieldCheck size={15} />5,000 DC per eligible account · 250,000 DC maximum · no expiry · no double claims</p>

      {status?.award ? (
        <p className="member-notice" role="status">
          You received the 5,000 DC launch reward · slot {status.award.slot} · {new Date(status.award.awarded_at).toLocaleString()}
        </p>
      ) : user ? (
        <div className="launch-actions">
          <Link to="/settings">{status?.eligibility.profile_complete ? 'Review my profile →' : 'Complete my profile →'}</Link>
          <button
            type="button"
            aria-busy={busy}
            disabled={busy || !status || slots === 0 || status.status !== 'active'}
            onClick={check}
          >
            {busy ? 'Checking eligibility…' : 'Check & receive 5,000 DC if eligible'}
          </button>
        </div>
      ) : compact ? (
        <p>Register, verify your email and complete your profile to qualify. Registration alone does not reserve a slot.</p>
      ) : (
        <Link className="design-button secondary" to="/register">Join the launch promotion →</Link>
      )}

      {user && status && !status.award && (
        <p className="launch-requirements">
          Email: {status.eligibility.verified ? 'verified' : 'verification required'} · Profile: {status.eligibility.profile_complete ? 'complete' : 'incomplete'}. Eligible awards are credited automatically when requirements are met; this button safely rechecks your eligibility and the remaining capacity.
        </p>
      )}
      {error && <p role="alert">{error} <button type="button" onClick={() => setVersion(v => v + 1)}>Retry status</button></p>}
      <small>DC are virtual platform credits, not cash or withdrawable money. Eligibility and remaining capacity are checked transactionally.</small>
    </section>
  )
}
