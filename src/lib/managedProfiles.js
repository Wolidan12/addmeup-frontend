import {USERNAME_RE,PLATFORMS,validSocialUrl,socialHref} from './validation.js'
export const newManagedDraft=()=>({key:crypto.randomUUID(),username:'',display_name:'',bio:'',country:'',interests:'',avatar_url:'',is_public:false,links:{}})
export function prepareManagedBatch(drafts){
 if(!Array.isArray(drafts)||drafts.length<1||drafts.length>25)throw new Error('Add between 1 and 25 profiles.')
 const seen=new Set()
 return drafts.map((d,i)=>{
  const fail=message=>{throw new Error(`Profile ${i+1}: ${message}`)},username=d.username.trim(),name=d.display_name.trim(),interests=d.interests.split(',').map(s=>s.trim()).filter(Boolean)
  if(!USERNAME_RE.test(username))fail('use 3–24 lowercase letters, numbers or underscores for the username.')
  if(seen.has(username))fail('this username appears twice in your batch.');seen.add(username)
  if(!name||name.length>60)fail('enter a display name of 1–60 characters.')
  if(d.bio.length>280||d.country.length>80)fail('bio or country is too long.')
  if(interests.length>10||interests.some(s=>s.length>40))fail('use up to ten interests, each 40 characters or fewer.')
  const social_links=PLATFORMS.filter(p=>d.links[p]?.trim()).map(platform=>{const url=d.links[platform].trim();if(!validSocialUrl(platform,url))fail(`use an official ${platform} link.`);return {platform,url:socialHref(platform,url),is_public:true}})
  return {username,display_name:name,bio:d.bio,country:d.country,interests:[...new Set(interests)],avatar_url:d.avatar_url||'',is_public:!!d.is_public,social_links}
 })
}
