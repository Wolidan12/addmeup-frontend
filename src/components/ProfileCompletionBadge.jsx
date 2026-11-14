import { BadgeCheck } from 'lucide-react';
import { hasCompleteProfile, PROFILE_BADGE_DESCRIPTION } from '../lib/profileBadge';

export default function ProfileCompletionBadge({ profile, showLabel = false }) {
  if (!hasCompleteProfile(profile)) return null;
  return <span className={`profile-complete-badge${showLabel ? ' profile-complete-badge-labeled' : ''}`} role="img" aria-label="Profile complete" title={PROFILE_BADGE_DESCRIPTION}>
    <BadgeCheck size={20} aria-hidden="true" focusable="false" />
    {showLabel && <span className="profile-complete-badge-text">Profile complete</span>}
  </span>;
}
