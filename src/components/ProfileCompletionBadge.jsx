import { BadgeCheck } from 'lucide-react';
import { hasCompleteProfile, PROFILE_BADGE_DESCRIPTION } from '../lib/profileBadge';

export default function ProfileCompletionBadge({ profile }) {
  if (!hasCompleteProfile(profile)) return null;
  return <span className="profile-complete-badge" role="img" aria-label="Profile complete" title={PROFILE_BADGE_DESCRIPTION}>
    <BadgeCheck size={20} aria-hidden="true" focusable="false" />
  </span>;
}
