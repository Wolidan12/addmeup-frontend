export const resources = [
 {key:'site_settings',label:'Site & platforms',icon:'⚙',group:'Operations',columns:['brand_name','hero_title','maintenance_mode','enabled_platforms'],search:'Search site name',roles:[]},
 {key:'bank_transfer_details',label:'Bank configuration',icon:'▣',group:'Commerce',columns:['bank_name','account_name','account_number'],search:'Search bank',roles:[]},
 {key:'boost_plans',label:'Booster plans',icon:'✦',group:'Growth',columns:['title','cost_points','multiplier','duration_hours','bonus_cap','is_active'],search:'Search booster plan',roles:[]},
 {key:'user_boosts',label:'Booster activations',icon:'↗',group:'Growth',columns:['user_id','plan_title','cost_points','bonus_used','expires_at'],search:'Search plan title',roles:['finance_admin']},
 {key:'referral_purchase_rewards',label:'Referral earnings',icon:'♧',group:'Growth',columns:['referrer_id','referred_id','points','percent','created_at'],search:'Search referrer UUID',roles:['finance_admin']},
 {key:'managed_profiles',label:'Managed listings',icon:'◈',group:'Community',columns:['username','display_name','country','is_public','created_at'],search:'Search listing username',roles:[]},
 {key:'point_packages',label:'Point packages',icon:'✧',group:'Commerce',columns:['title','points','price_kobo','is_active'],search:'Search point package',roles:[]},
 {key:'bank_point_orders',label:'Bank transfers',icon:'▤',group:'Commerce',columns:['user_id','package_title','points','amount_kobo','status','created_at'],search:'Search payer name',filters:['awaiting_transfer','submitted','approved','rejected','cancelled'],roles:['finance_admin']},
 {key:'profiles',label:'Users & profiles',icon:'◉',group:'Community',columns:['username','display_name','country','is_public','created_at'],search:'Search username',roles:['moderator','support_agent']},
 {key:'social_links',label:'Social accounts',icon:'↗',group:'Community',columns:['platform','profile_id','url','is_public'],search:'Search social URL',filters:['whatsapp','instagram','snapchat','tiktok','facebook','x'],roles:['moderator']},
 {key:'reports',label:'Moderation',icon:'⚑',group:'Community',columns:['reason','profile_id','status','created_at'],search:'Search complaint',filters:['open','resolved','dismissed'],roles:['moderator','support_agent']},
 {key:'points_balance',label:'Points & streaks',icon:'✧',group:'Growth',columns:['user_id','balance','current_streak','last_checkin'],search:'Search referral code',roles:['finance_admin']},
 {key:'points_ledger',label:'Points ledger',icon:'⇄',group:'Growth',columns:['user_id','points','reason','created_at'],search:'Search transaction reason',roles:['finance_admin']},
 {key:'reward_tasks',label:'Daily tasks',icon:'☑',group:'Growth',columns:['title','points','daily_limit','is_active'],search:'Search task title',roles:['moderator']},
 {key:'referrals',label:'Referrals',icon:'♧',group:'Growth',columns:['referrer_id','referred_id','rewarded','created_at'],search:'Search referred user UUID',roles:['finance_admin']},
 {key:'promotions',label:'Promotion packages',icon:'◇',group:'Commerce',columns:['title','description','price_kobo','is_active'],search:'Search package',roles:['finance_admin']},
 {key:'payment_transactions',label:'Payments',icon:'▣',group:'Commerce',columns:['reference','provider','amount_kobo','status','created_at'],search:'Search payment reference',filters:['pending','verified','failed','refunded'],roles:['finance_admin']},
 {key:'subscriptions',label:'Subscriptions',icon:'↻',group:'Commerce',columns:['user_id','plan','status','expires_at'],search:'Search plan',filters:['active','cancelled','expired'],roles:['finance_admin']},
 {key:'notifications',label:'Notifications',icon:'♧',group:'Operations',columns:['user_id','title','body','is_read','created_at'],search:'Search notification title',roles:['support_agent']},
 {key:'user_roles',label:'Team & access',icon:'♙',group:'Operations',columns:['user_id','role','created_at'],search:'Search staff UUID',filters:['super_admin','admin','moderator','finance_admin','support_agent','user'],roles:[]},
 {key:'account_restrictions',label:'Restrictions',icon:'⊘',group:'Operations',columns:['user_id','reason','created_at'],search:'Search restriction reason',roles:[]},
 {key:'audit_logs',label:'Audit trail',icon:'≡',group:'Operations',columns:['actor_id','action','target','created_at'],search:'Search action',roles:[]},
 {key:'reward_config',label:'Reward settings',icon:'⚙',group:'Operations',columns:['key','value'],search:'Search setting key',roles:[]},
]
export const canView=(role,resource)=>role==='super_admin'||resource.roles.includes(role)
export function rowActions(resource,row,role){
 const root=role==='super_admin',mod=root||role==='moderator'
 const actions=[]
 if(resource==='boost_plans'&&root)actions.push({action:'edit_boost',label:'Edit booster plan'})
 if(resource==='site_settings'&&root)actions.push({action:'edit_site',label:'Edit site settings'})
 if(resource==='bank_transfer_details'&&root)actions.push({action:'edit_bank',label:'Change bank details'})
 if(resource==='profiles'&&root)actions.push({action:'edit_profile',label:'Edit profile details'})
 if(resource==='reward_tasks'&&root)actions.push({action:'edit_task',label:'Edit task rules'})
 if(resource==='point_packages'&&root)actions.push({action:'edit_package',label:'Edit package'})
 if(resource==='managed_profiles'&&root)actions.push({action:'edit_listing',label:'Edit listing'})
 if(resource==='bank_point_orders'&&(root||role==='finance_admin')&&row.status==='submitted')actions.push({action:'approve_bank',label:'Confirm received funds & credit points'},{action:'reject_bank',label:'Reject payment'})
 if(resource==='profiles'){
  if(mod) actions.push({action:'restrict',label:'Restrict account'},{action:'reactivate',label:'Remove restriction'})
  if(root) actions.push({action:'adjust_points',label:'Adjust points'},{action:'set_role',label:'Assign role'})
  if(root||role==='support_agent') actions.push({action:'notify',label:'Send notification'})
 }
 if(resource==='reports'&&mod&&row.status==='open')actions.push({action:'resolve_report',label:'Resolve report'},{action:'dismiss_report',label:'Dismiss report'})
 if(resource==='social_links'&&mod&&row.is_public)actions.push({action:'hide_social',label:'Hide social link'})
 if(resource==='payment_transactions'&&(root||role==='finance_admin')&&row.status==='pending'&&row.provider==='paystack')actions.push({action:'verify_payment',label:'Verify with Paystack'})
 if(resource==='reward_tasks'&&root&&['complete-profile','add-social-link'].includes(row.slug))actions.push({action:'toggle_task',label:row.is_active?'Pause task':'Enable task'})
 if(resource==='reward_config'&&root)actions.push({action:'configure_reward',label:'Change value'})
 if(resource==='account_restrictions'&&root)actions.push({action:'reactivate',label:'Remove restriction'})
 if(resource==='user_roles'&&root)actions.push({action:'set_role',label:'Assign role'})
 return actions
}
export const formatLabel=s=>s.replaceAll('_',' ')
export function csv(rows,columns){
 const cell=value=>{let s=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
 return [columns,...rows.map(r=>columns.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n')
}
