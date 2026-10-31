// Managed listings retain their separately audited six-platform contract.
export const MANAGED_PLATFORMS=['whatsapp','snapchat','instagram','tiktok','facebook','x']
export const USERNAME_RE=/^[a-z0-9_]{3,24}$/
export const PLATFORMS=['whatsapp','snapchat','instagram','tiktok','facebook','x','youtube','telegram']
export const PLATFORM_HOSTS={snapchat:['snapchat.com'],instagram:['instagram.com'],tiktok:['tiktok.com'],facebook:['facebook.com','fb.com'],x:['x.com','twitter.com'],youtube:['youtube.com','youtu.be'],telegram:['t.me','telegram.me']}
export function waMeUrl(raw){const d=String(raw||'').replace(/\D/g,'');return d?`https://wa.me/${encodeURIComponent(d)}`:null}
export function validSocialUrl(platform,value,catalogue=[]){if(typeof value!=='string'||!value||value.length>500||/[\\<>]/.test(value))return false; if(platform==='whatsapp')return (/^\+?[\d -]{7,20}$/.test(value)&&value.replace(/\D/g,'').length>=7)||/^https:\/\/wa\.me\/[0-9]{7,20}$/.test(value); try{const u=new URL(value.startsWith('http')?value:'https://'+value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!/[\s<>]/.test(value)&&u.pathname!=='/'&&(catalogue.find(p=>p.key===platform)?.hosts||PLATFORM_HOSTS[platform]||[]).some(h=>u.hostname===h||u.hostname==='www.'+h)}catch{return false}}
export function socialHref(p,v){if(p==='whatsapp')return waMeUrl(v);const href=v.startsWith('http')?v:'https://'+v;if(p==='facebook'){try{const u=new URL(href);if(u.hostname==='fb.com'||u.hostname==='www.fb.com'){u.hostname='www.facebook.com';return u.href}}catch{}}return href}
