-- READ-ONLY. Run in the existing project's SQL editor. Does not apply migrations,
-- grant roles, alter policies, delete data or expose secrets/user emails.
select name, to_regprocedure(signature) is not null as installed
from (values
 ('Admin access (006)', 'public.admin_role()'),
 ('Admin tables (006)', 'public.admin_list(text,text,text,integer)'),
 ('Provider settlement (008)', 'public.settle_verified_payment(text,bigint,text,text,text)'),
 ('Bank orders (009)', 'public.create_bank_point_order(uuid,uuid)'),
 ('Member dashboard (010)', 'public.member_overview()'),
 ('Directory (010)', 'public.public_directory(text,text,text,text,integer)'),
 ('Referral page (010)', 'public.member_referrals(integer)'),
 ('Booster activation (010)', 'public.activate_point_boost(uuid,uuid)')
) as required(name,signature);
-- All installed values should be true for the merged member/admin release.
-- This tests function presence only, not full schema/RLS correctness or your role.
