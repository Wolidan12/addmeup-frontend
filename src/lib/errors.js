// Never render an arbitrary database/provider exception in the customer interface.
const messages = {
  invalid_credentials: "The email or password is incorrect. Please try again.",
  email_not_confirmed: "Please verify your email before signing in.",
  over_email_send_rate_limit:
    "Please wait a little before requesting another email.",
  over_request_rate_limit: "Too many attempts. Please wait and try again.",
  weak_password: "Choose a stronger password with at least eight characters.",
  otp_expired: "This link has expired. Request a new email and try again.",
  user_banned: "This account is unavailable. Please contact support.",
};
const business = [
  [
    /Already checked in today/i,
    "You have already claimed today’s check-in. Come back tomorrow.",
  ],
  [/Daily limit reached/i, "You have reached this task’s daily claim limit."],
  [
    /Complete your profile first/i,
    "Add your bio, country and interests before claiming this reward.",
  ],
  [
    /Add a public HTTPS social link first/i,
    "Add an eligible public social link before claiming this reward.",
  ],
  [
    /Account restricted/i,
    "Your account has a restriction. Contact support for help.",
  ],
  [
    /maintenance/i,
    "This action is temporarily paused while we make improvements.",
  ],
  [/Not enough points/i, "You do not have enough points for this plan."],
  [
    /already have an active booster/i,
    "You already have an active booster. Wait until it expires.",
  ],
  [
    /Invalid referral code/i,
    "That referral code cannot be used. Check the code and try again.",
  ],
  [
    /first approved purchase/i,
    "A referral must be linked before your first approved purchase.",
  ],
  [
    /Circular referrals/i,
    "This referral cannot be linked. Please use a different invitation.",
  ],
  [
    /Finish or cancel your existing payment requests/i,
    "Finish or cancel an existing unpaid order before creating another.",
  ],
  [
    /Package is no longer available/i,
    "This package is no longer available. Refresh to see current packages.",
  ],
  [
    /Upload payment evidence first/i,
    "Upload your payment receipt before submitting.",
  ],
  [/Choose a JPG, PNG or WebP/i, "Choose a JPG, PNG or WebP image."],
  [/Image must be 5 MB/i, "Choose an image that is 5 MB or smaller."],
  [/image is empty/i, "This image is empty. Please choose another file."],
];
export function publicError(
  error,
  fallback = "We could not complete that action. Please try again.",
) {
  if (messages[error?.code]) return messages[error.code];
  if (error?.code === "23505")
    return "That information is already in use or has already been submitted. Please check and try again.";
  if (typeof error?.message === "string")
    for (const [pattern, message] of business)
      if (pattern.test(error.message)) return message;
  return fallback;
}
export function withTimeout(operation, ms = 12000) {
  let timer;
  return Promise.race([
    Promise.resolve(operation),
    new Promise((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            Object.assign(new Error("Request timed out"), {
              code: "request_timeout",
            }),
          ),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
