import { USERNAME_RE } from "./validation.js";
import { InputError } from "./errors.js";
const clean = (
  value,
  max,
  label,
  { required = false, multiline = false } = {},
) => {
  const text = String(value ?? "").trim();
  if (
    (required && !text) ||
    text.length > max ||
    /[<>]/.test(text) ||
    (multiline
      ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
      : /[\u0000-\u001f\u007f]/
    ).test(text)
  )
    throw new InputError(
      `Enter a valid ${label}${required ? " (required)" : ""}, up to ${max} characters. Plain text only.`,
    );
  return text;
};
export function registrationDetails(values) {
  const full_name = clean(values.full_name, 60, "full name", {
      required: true,
    }),
    username = String(values.username || "")
      .trim()
      .toLowerCase(),
    email = String(values.email || "")
      .trim()
      .toLowerCase(),
    password = String(values.password || "");
  if (!USERNAME_RE.test(username))
    throw new InputError(
      "Use 3–24 lowercase letters, numbers or underscores for your username.",
    );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new InputError("Enter a valid email address.");
  if (password.length < 8 || password.length > 128)
    throw new InputError("Use a password between 8 and 128 characters.");
  if (password !== values.confirm)
    throw new InputError("The passwords do not match.");
  if (values.terms_accepted !== true)
    throw new InputError(
      "Accept the Terms and Privacy Policy to create your account.",
    );
  return {
    email,
    password,
    metadata: { full_name, username, terms_accepted: true },
  };
}
function tags(value, max, label) {
  const items = (Array.isArray(value) ? value : String(value || "").split(","))
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (items.length > max) throw new InputError(`Choose up to ${max} ${label}.`);
  return [
    ...new Set(items.map((v) => clean(v, 40, label, { required: true }))),
  ];
}
export function profileDetails(values) {
  const username = String(values.username || "")
    .trim()
    .toLowerCase();
  if (!USERNAME_RE.test(username))
    throw new InputError(
      "Use 3–24 lowercase letters, numbers or underscores for your username.",
    );
  return {
    username,
    display_name: clean(values.display_name, 60, "display name", {
      required: true,
    }),
    bio: clean(values.bio, 280, "biography", { multiline: true }),
    country: clean(values.country, 80, "country"),
    location: clean(values.location, 100, "location"),
    interests: tags(values.interests, 10, "interests"),
    categories: tags(values.categories, 5, "categories"),
    is_public: values.is_public === true,
  };
}
export function profileCompletion(profile, socialCount = 0) {
  if (!profile) return 0;
  const values = [
    profile.display_name,
    profile.username,
    profile.avatar_url,
    profile.bio,
    profile.country,
    profile.interests?.length,
    socialCount > 0,
  ];
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}
