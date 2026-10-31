# Purple profile-completion mark

Complete member profiles show a purple check beside their name in shared creator cards (home, discovery, profile detail, connections and dashboard recommendations), the account sidebar and dashboard creator passport.

Eligibility uses the existing six required fields: display name, username, photo URL, bio, country and at least one nonblank interest. No social link, purchase or administrator payment is required. Missing/blank fields remove the mark on the next fresh profile render. Managed listings do not receive member marks. Image URL presence is checked, not identity or ownership of the photograph; network image availability cannot establish identity either.

The accessible label is **Profile complete**. Hover text explains the criteria and explicitly says **Not identity verification**. This is a free visual completion indicator derived from existing database profile data, not a persisted verification flag, email check, identity endorsement, permission grant or Instagram verification. Paid cosmetic badges remain distinct. Existing optional-link readiness percentages may differ because they also include social-link readiness.

No schema, roles, credits, Auth or production data changes are required. No new backend calls or private account data are exposed. Shared helper: `src/lib/profileBadge.js`; component: `src/components/ProfileCompletionBadge.jsx`; test: `tests/profile-completion-badge.test.mjs`.

This change is source-only until the reviewed frontend release is deployed. Existing production migration/recovery gates still apply.
