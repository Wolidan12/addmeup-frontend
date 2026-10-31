export const resources = [
 {key:'creator_progress',label:'Creator XP and levels',group:'Growth',columns:['username','creator_xp','creator_rank','email_confirmed'],search:'Search creator username or email',roles:['moderator']},
 {key:'member_connections',label:'Free member connections',group:'Community',columns:['member_username','connected_username','created_at'],search:'Search connected username or member UUID',roles:['moderator','support_agent']},
 {key:'support_tickets',label:'Support tickets',group:'Operations',columns:['subject','category','user_id','status','updated_at'],search:'Search subject or member UUID',filters:['open','investigating','awaiting_member','resolved'],roles:['support_agent','finance_admin']},
 {key:'coupons',label:'DC gift coupons',group:'Commerce',columns:['code','credits','max_redemptions','redeemed','is_active','expires_at'],search:'Search coupon code',roles:['finance_admin']},
 {key:'analytics',label:'Analytics and reports',group:'Operations',columns:[],search:'Search reports',roles:['finance_admin']},
 {key:'social_platforms',label:'Social platform directory',group:'Community',columns:['key','label','hosts'],search:'Search platform name',roles:[]},
 {key:'promotion_campaigns',label:'Promotion campaigns',icon:'✧',group:'Commerce',columns:['user_id','title','cost_dc','duration_hours','status','starts_at','ends_at'],search:'Search campaign title',filters:['pending','active','expired','paused','rejected'],roles:['finance_admin']},
 {key:'missions',label:'Missions & launch',icon:'✧',group:'Growth',columns:['title','cadence','kind','reward_dc','reward_xp','requires_approval','deadline','is_active'],search:'Search mission title',roles:[]},
 {key:'mission_submissions',label:'Mission evidence',icon:'☑',group:'Growth',columns:['user_id','mission_title','period_key','status','submitted_at'],search:'Search evidence',filters:['submitted','awarded','rejected'],roles:[]},
 {key:'mission_awards',label:'Mission awards',icon:'⇄',group:'Growth',columns:['user_id','kind','amount_dc','xp','awarded_at','activity_reference'],search:'Search awarded user UUID',roles:['finance_admin']},
 {key:'launch_awards',label:'Launch award history',icon:'✦',group:'Growth',columns:['slot','user_id','amount_dc','awarded_at','activity_reference'],search:'Search launch recipient UUID',roles:['finance_admin']},
 {key:'dc_transactions',label:'DC transaction journal',icon:'⇄',group:'Commerce',columns:['user_id','transaction_reference','transaction_type','credit_amount','previous_balance','new_balance','status','created_at'],search:'Search DC reference',filters:['successful'],roles:['finance_admin']},
 {key:'dc_orders',label:'Premium requests',icon:'✧',group:'Commerce',columns:['user_id','product_title','cost_dc','status','created_at'],search:'Search premium feature',filters:['pending_fulfillment','completed','refunded'],roles:['finance_admin']},
 {key:'site_settings',label:'Site & platforms',icon:'⚙',group:'Operations',columns:['brand_name','hero_title','maintenance_mode','enabled_platforms'],search:'Search site name',roles:[]},
 {key:'bank_transfer_details',label:'Bank configuration',icon:'▣',group:'Commerce',columns:['bank_name','account_name','account_number'],search:'Search bank',roles:[]},
 {key:'boost_plans',label:'Booster plans',icon:'✦',group:'Growth',columns:['title','cost_points','multiplier','duration_hours','bonus_cap','is_active'],search:'Search booster plan',roles:[]},
 {key:'user_boosts',label:'Booster activations',icon:'↗',group:'Growth',columns:['user_id','plan_title','cost_points','bonus_used','expires_at'],search:'Search plan title',roles:['finance_admin']},
 {key:'referral_purchase_rewards',label:'Referral awards (gross)',icon:'♧',group:'Growth',columns:['referrer_id','referred_id','points','percent','created_at'],search:'Search referrer UUID',roles:['finance_admin']},
 {key:'managed_profiles',label:'Managed listings',icon:'◈',group:'Community',columns:['username','display_name','country','is_public','created_at'],search:'Search listing username',roles:[]},
 {key:'point_packages',label:'DC catalogue & packages',icon:'✧',group:'Commerce',columns:['title','points','price_kobo','is_active'],search:'Search credit package',roles:[]},
 {key:'bank_point_orders',label:'Bank transfers',icon:'▤',group:'Commerce',columns:['username','email','points','amount_kobo','status','created_at'],search:'Search username, email or payment reference',filters:['awaiting_transfer','submitted','approved','rejected','cancelled','refunded'],roles:['finance_admin']},
 {key:'profiles',label:'Users & profiles',icon:'◉',group:'Community',columns:['username','display_name','email_confirmed','suspended','creator_xp','created_at'],search:'Search username, email or member UUID',filters:['verified','unverified','suspended'],roles:['moderator','support_agent','finance_admin']},
 {key:'social_links',label:'Social accounts',icon:'↗',group:'Community',columns:['platform','profile_id','url','is_public'],search:'Search social URL',filters:['whatsapp','instagram','snapchat','tiktok','facebook','x'],roles:['moderator']},
 {key:'reports',label:'Moderation',icon:'⚑',group:'Community',columns:['reason','profile_id','status','created_at'],search:'Search complaint',filters:['open','resolved','dismissed'],roles:['moderator','support_agent']},
 {key:'points_balance',label:'DC balances & streaks',icon:'✧',group:'Growth',columns:['user_id','balance','current_streak','last_checkin'],search:'Search referral code',roles:['finance_admin']},
 {key:'points_ledger',label:'Legacy rewards ledger',icon:'⇄',group:'Growth',columns:['user_id','points','reason','created_at'],search:'Search transaction reason',roles:['finance_admin']},
 {key:'reward_tasks',label:'Legacy tasks (archive)',icon:'☑',group:'Growth',columns:['title','points','daily_limit','is_active'],search:'Search task title',roles:['moderator']},
 {key:'referrals',label:'Referrals',icon:'♧',group:'Growth',columns:['referrer_id','referred_id','rewarded','created_at'],search:'Search referred user UUID',roles:['finance_admin']},
 {key:'promotions',label:'Promotion packages',icon:'◇',group:'Commerce',columns:['title','description','price_kobo','is_active'],search:'Search package',roles:['finance_admin']},
 {key:'payment_transactions',label:'Online payments archive',icon:'▣',group:'Commerce',columns:['reference','provider','amount_kobo','status','created_at'],search:'Search payment reference',filters:['pending','verified','failed','refunded'],roles:['finance_admin']},
 {key:'subscriptions',label:'Subscriptions',icon:'↻',group:'Commerce',columns:['user_id','plan','status','expires_at'],search:'Search plan',filters:['active','cancelled','expired'],roles:['finance_admin']},
 {key:'notifications',label:'Push & notifications',icon:'♧',group:'Operations',columns:['user_id','title','body','is_read','created_at'],search:'Search notification title',roles:['support_agent']},
 {key:'user_roles',label:'Team & access',icon:'♙',group:'Operations',columns:['user_id','role','created_at'],search:'Search staff UUID',filters:['super_admin','admin','moderator','finance_admin','support_agent','user'],roles:[]},
 {key:'account_restrictions',label:'Restrictions',icon:'⊘',group:'Operations',columns:['user_id','reason','created_at'],search:'Search restriction reason',roles:[]},
 {key:'audit_logs',label:'Audit trail',icon:'≡',group:'Operations',columns:['actor_id','action','target','created_at'],search:'Search action',roles:[]},
 {key:'reward_config',label:'Legacy rules (archive)',icon:'⚙',group:'Operations',columns:['key','value'],search:'Search setting key',roles:[]},
]
export const canView=(role,resource)=>role==='super_admin'||resource.roles.includes(role)
export function rowActions(resource,row,role){
 const root=role==='super_admin',mod=root||role==='moderator'
 const actions=[]
 if(resource==='coupons'&&root)actions.push({action:'edit_coupon',label:'Configure coupon'})
 if(resource==='support_tickets'&&(root||role==='support_agent'||role==='finance_admin'))actions.push({action:'support_ticket',label:'Reply and update ticket'})
 if(resource==='promotion_campaigns'&&root){if(row.status==='pending')actions.push({action:'promotion_approve',label:'Approve paid placement'});if(['pending','active','paused'].includes(row.status))actions.push({action:'promotion_reject',label:'Reject & refund full DC'});if(row.status==='active')actions.push({action:'promotion_pause',label:'Pause paid placement'});if(row.status==='paused')actions.push({action:'promotion_resume',label:'Resume remaining window'})}
 if(resource==='missions'&&root)actions.push({action:'edit_mission',label:'Configure mission'})
 if(resource==='mission_submissions'&&root&&row.status==='submitted')actions.push({action:'mission_approve',label:'Approve verified mission evidence'},{action:'mission_reject',label:'Reject mission evidence'})
 if(resource==='dc_orders'&&root&&row.status==='pending_fulfillment'&&!row.is_promotion)actions.push({action:'dc_fulfill',label:'Confirm completed delivery'},{action:'dc_refund',label:'Refund unfulfilled request in DC'})
 if(resource==='boost_plans'&&root)actions.push({action:'edit_boost',label:'Edit booster plan'})
 if(resource==='site_settings'&&root)actions.push({action:'edit_site',label:'Edit site settings'})
 if(resource==='bank_transfer_details'&&root)actions.push({action:'edit_bank',label:'Change bank details'})
 if(resource==='profiles'&&root)actions.push({action:'edit_profile',label:'Edit profile details'})
 if(resource==='point_packages'&&root)actions.push({action:'edit_package',label:'Edit package'})
 if(resource==='managed_profiles'&&root)actions.push({action:'edit_listing',label:'Edit listing'})
 if(resource==='bank_point_orders'&&(root||role==='finance_admin')&&row.status==='submitted')actions.push({action:'approve_bank',label:'Confirm received funds & credit DC'},{action:'reject_bank',label:'Reject payment'})
 if(resource==='profiles'){
  if(mod&&!row.is_self&&(!row.staff_role||row.staff_role==='user'))actions.push(row.suspended?{action:'reactivate',label:'Remove restriction'}:{action:'restrict',label:'Restrict account'})
  if(root)actions.push({action:'adjust_points',label:'Adjust DC balance'});if(root&&!row.is_self)actions.push({action:'set_role',label:'Assign role'})
  if(root||role==='support_agent') actions.push({action:'notify',label:'Send notification'})
 }
 if(resource==='reports'&&mod&&row.status==='open')actions.push({action:'resolve_report',label:'Resolve report'},{action:'dismiss_report',label:'Dismiss report'})
 if(resource==='social_links'&&mod&&row.is_public)actions.push({action:'hide_social',label:'Hide social link'})
 if(resource==='account_restrictions'&&root)actions.push({action:'reactivate',label:'Remove restriction'})
 if(resource==='user_roles'&&root&&!row.is_self)actions.push({action:'set_role',label:'Assign role'})
 if(resource==='bank_point_orders'&&(root||role==='finance_admin')&&row.status==='approved')actions.push({action:'refund_bank',label:'Record confirmed external refund'})
 return actions
}
export const formatLabel=s=>({points:'DC amount',balance:'DC balance',cost_points:'Cost (DC)',cost_dc:'Cost (DC)',reward_dc:'Reward (DC)',amount_dc:'Award (DC)',reward_xp:'Creator XP reward',credit_amount:'DC change',previous_balance:'Previous DC balance',new_balance:'New DC balance'}[s]||s.replaceAll('_',' '))
export function csv(rows,columns){
 const cell=value=>{let s=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
 return [columns,...rows.map(r=>columns.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n')
}
