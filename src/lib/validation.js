export const USERNAME_RE=/^[a-z0-9_]{3,24}$/
export const PLATFORMS=['whatsapp','snapchat','instagram','tiktok','facebook','x']
export const PLATFORM_HOSTS={snapchat:['snapchat.com'],instagram:['instagram.com'],tiktok:['tiktok.com'],facebook:['facebook.com','fb.com'],x:['x.com','twitter.com']}
export function waMeUrl(raw){const d=String(raw||'').replace(/\D/g,'');return d?`https://wa.me/${encodeURIComponent(d)}`:null}
export function validSocialUrl(platform,value){if(!value)return false; if(platform==='whatsapp')return /^\+?[\d\s-]{7,20}$/.test(value)||/^https:\/\/wa\.me\/[0-9]{7,20}$/.test(value); try{const u=new URL(value.startsWith('http')?value:'https://'+value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!/[\s<>]/.test(value)&&u.pathname!=='/'&&(PLATFORM_HOSTS[platform]||[]).some(h=>u.hostname===h||u.hostname==='www.'+h)}catch{return false}}
export function socialHref(p,v){if(p==='whatsapp')return waMeUrl(v);const href=v.startsWith('http')?v:'https://'+v;if(p==='facebook'){try{const u=new URL(href);if(u.hostname==='fb.com'||u.hostname==='www.fb.com'){u.hostname='www.facebook.com';return u.href}}catch{}}return href}
