import {prepareManagedEdit} from '../lib/managedProfiles'
import {publicError} from '../lib/errors'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {uploadImage} from '../lib/uploads'
import {useAuth} from '../context/AuthContext'
import {MANAGED_PLATFORMS as PLATFORMS} from '../lib/validation'
export default function CreateDialog({operation,onClose,onSaved}){
 const {user}=useAuth(),isPackage=operation.action==='edit_package',row=operation.row||{},id=useRef(row.id||crypto.randomUUID()),dialog=useRef(null)
 const [form,setForm]=useState({title:row.title||'',points:row.points||'',price:row.price_kobo?String(row.price_kobo/100):'',username:row.username||'',display_name:row.display_name||'',bio:row.bio||'',country:row.country||'',interests:(row.interests||[]).join(', '),avatar_url:row.avatar_url||'',is_active:row.is_active??true,is_public:row.is_public??false}),[links,setLinks]=useState(Object.fromEntries((row.social_links||[]).map(l=>[l.platform,l.url]))),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{dialog.current.showModal()},[])
 const field=(name,value)=>setForm(f=>({...f,[name]:value}))
 async function photo(e){const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{const {url}=await uploadImage('managed-avatars',user.id,file);field('avatar_url',url)}catch(e){setError(publicError(e,'We could not complete this staff action. Please retry or contact the platform owner.'))}finally{setBusy(false);e.target.value=''}}
 async function save(e){e.preventDefault();setBusy(true);setError('');try{
  let result
  if(isPackage){
   if(!/^\d+$/.test(String(form.points)))throw new Error('Enter a whole DC package amount. ₦1 = 1 DC.')
   result=await supabase.rpc('admin_save_point_package',{p_id:id.current,p_title:form.title,p_points:Number(form.points),p_price_kobo:Number(form.points)*100,p_active:form.is_active,p_reason:reason})
  }else {
   let payload
   try{payload=prepareManagedEdit(form,links,row.social_links||[])}catch(e){setError(e.message);return}
   result=await supabase.rpc('admin_save_managed_profile',{p_id:id.current,p_reason:reason,p_data:payload})
  }
  if(result.error)throw result.error
  onSaved(isPackage?'Point package saved. Existing orders keep their original price and points.':'Managed profile saved. No login account was created.');onClose()
 }catch(e){setError(publicError(e,'We could not complete this staff action. Please retry or contact the platform owner.'))}finally{setBusy(false)}}
 return <dialog className="ad-dialog" ref={dialog} aria-labelledby="create-title" onCancel={e=>{if(busy)e.preventDefault();else onClose()}}><form onSubmit={save}><div className="ad-eyebrow">SUPER ADMIN · AUDITED CHANGE</div><h2 id="create-title">{row.id?'Edit':'Create'} {isPackage?'point package':'managed profile'}</h2>
 {isPackage?<><label>Package title<input required maxLength={80} value={form.title} onChange={e=>field('title',e.target.value)}/></label><label>Credits (DC)<input type="number" min="1" max="1000000" step="1" required value={form.points} onChange={e=>field('points',e.target.value)}/></label><p>Fixed package price: ₦{Number(form.points||0).toLocaleString()}. Official rate: ₦1 = 1 DC; the exchange rate cannot be edited.</p><label className="flex gap-2"><input className="w-auto" type="checkbox" checked={form.is_active} onChange={e=>field('is_active',e.target.checked)}/>Available for purchase</label></>:<><p className="ad-muted">This is an admin-managed listing, not a user account. Only publish details and photos you have permission to use.</p><label>Display name<input required maxLength={60} value={form.display_name} onChange={e=>field('display_name',e.target.value)}/></label><label>Listing username<input required pattern="[a-z0-9_]{3,24}" maxLength={24} value={form.username} onChange={e=>field('username',e.target.value.toLowerCase())}/></label><label>Bio<textarea maxLength={280} value={form.bio} onChange={e=>field('bio',e.target.value)}/></label><label>Country<input maxLength={80} value={form.country} onChange={e=>field('country',e.target.value)}/></label><label>Interests, comma separated<input maxLength={500} value={form.interests} onChange={e=>field('interests',e.target.value)}/></label>{form.avatar_url&&<img src={form.avatar_url} alt="Listing portrait" referrerPolicy="no-referrer" className="w-20 h-20 rounded-full object-cover"/>}<label>Upload portrait (JPG/PNG/WebP, max 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={photo}/></label>{form.avatar_url&&<button type="button" disabled={busy} onClick={()=>field('avatar_url','')}>Remove photo from listing</button>}{PLATFORMS.map(p=><label key={p}>{p} public URL<input type="url" placeholder={p==='whatsapp'?'https://wa.me/234…':`https://${p==='x'?'x':p}.com/…`} value={links[p]||''} onChange={e=>setLinks(l=>({...l,[p]:e.target.value}))}/></label>)}<label className="flex gap-2"><input className="w-auto" type="checkbox" checked={form.is_public} onChange={e=>field('is_public',e.target.checked)}/>Publish in Discover</label></>}
 <label>Reason / internal note<textarea required minLength={8} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p className="ad-error" role="alert">{error}</p>}<div className="ad-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="ad-primary" disabled={busy||reason.trim().length<8}>{busy?'Saving…':'Confirm and save'}</button></div></form></dialog>
}
