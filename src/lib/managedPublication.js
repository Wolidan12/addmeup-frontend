import {withTimeout} from './errors.js'
// A successful save is not proof of public publication. Check the actual two read paths.
// Exact @handle search avoids false failures when a similarly named profile fills page one.
export async function verifyManagedPublication(client,records){
 const published=records.filter(r=>r.is_public)
 for(let start=0;start<published.length;start+=5)await Promise.all(published.slice(start,start+5).map(async r=>{
  const [feed,profile]=await Promise.all([
   withTimeout(client.rpc('public_directory',{p_search:'@'+r.username,p_page:0})),
   withTimeout(client.rpc('discovery_profile',{p_username:r.username,p_managed:true}))
  ])
  if(feed.error||profile.error||!feed.data?.rows?.some(p=>p.id===r.id&&p.managed===true)||profile.data?.id!==r.id||profile.data?.managed!==true)throw new Error('Public managed publication not confirmed')
 }))
}
