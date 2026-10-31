export function safeDestination(value: unknown, origin: string) {
 const url=new URL(typeof value==='string'?value:'/notifications',origin)
 return url.origin===origin && ['/notifications','/missions','/wallet','/discover','/connections','/boosts','/settings','/release-notes'].includes(url.pathname)?url.href:origin+'/notifications'
}
export function pushOutcome(status: number) {return status>=200&&status<300?'accepted':status===404||status===410?'gone':status===429||status>=500||status===0?'retry':'failed'}
export function retrySeconds(value: string|null, now=Date.now()) {if(!value)return 0;const n=Number(value);return Math.max(0,Math.min(21600,Number.isFinite(n)?n:Math.ceil((Date.parse(value)-now)/1000)||0))}
export function equalSecret(a: string,b: string) {const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]||0)^(y[i]||0);return d===0&&x.length>0}
export function validEndpoint(endpoint: string) {try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/.test(u.hostname)}catch{return false}}
export function productionMarker(value: unknown, expected: string) {const v=value as {commit?:string,builtAt?:string,sourceDirty?:boolean};return /^[a-f0-9]{40}$/.test(expected)&&v?.sourceDirty!==true&&v?.commit===expected&&Number.isFinite(Date.parse(v.builtAt||''))&&Date.parse(v.builtAt!)<=Date.now()+300000}

export function productionHtml(html: string,expected: string) {return html.includes('name="danqel-build" content="'+expected+'"')&&html.includes('/assets/')}
