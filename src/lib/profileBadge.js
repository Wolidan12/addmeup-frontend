// A completion indicator only: never an identity, payment or permission grant.
// Matches the six required profile fields used by launch_profile_complete.
export const PROFILE_BADGE_DESCRIPTION = 'Profile complete: name, username, photo, bio, country and interests added. Not identity verification.';
export function hasCompleteProfile(profile) {
  if (!profile || profile.managed) return false;
  const filled = value => typeof value === 'string' && value.trim().length > 0;
  return filled(profile.display_name) && profile.display_name.trim().length >= 2
    && profile.display_name !== 'New creator'
    && filled(profile.username) && profile.username.trim().length >= 3
    && ['avatar_url', 'bio', 'country'].every(key => filled(profile[key]))
    && Array.isArray(profile.interests) && profile.interests.some(filled);
}
