// A completion indicator only: never an identity, payment or permission grant.
// Matches the six required profile fields used by launch_profile_complete.
export const PROFILE_BADGE_DESCRIPTION = 'Profile complete: name, username, photo, bio, country and interests added. Not identity verification.';
export function missingProfileRequirements(profile) {
  const missing = [];
  const filled = value => typeof value === 'string' && value.trim().length > 0;
  if (!profile || !filled(profile.display_name) || profile.display_name.trim().length < 2 || profile.display_name.trim() === 'New creator') {
    missing.push('Display name (at least 2 characters)');
  }
  if (!profile || !filled(profile.username) || profile.username.trim().length < 3) {
    missing.push('Username (at least 3 characters)');
  }
  if (!profile || !filled(profile.avatar_url)) missing.push('Profile photo');
  if (!profile || !filled(profile.bio)) missing.push('Bio');
  if (!profile || !filled(profile.country)) missing.push('Country');
  if (!profile || !Array.isArray(profile.interests) || !profile.interests.some(filled)) {
    missing.push('At least one interest');
  }
  return missing;
}

export function hasCompleteProfile(profile) {
  return missingProfileRequirements(profile).length === 0;
}
