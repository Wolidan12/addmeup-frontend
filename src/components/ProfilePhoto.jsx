import {useEffect,useState} from 'react'
import {useAuth} from '../context/AuthContext'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
import {uploadImage} from '../lib/uploads'
export default function ProfilePhoto({current,onSaved}){
 const {user}=useAuth(),[photo,setPhoto]=useState(current),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 useEffect(()=>setPhoto(current),[current])
 async function upload(e){const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');setMessage('')
  try{
   const image=await uploadImage('avatars',user.id,file)
   const {data,error}=await supabase.from('profiles').update({avatar_url:image.url}).eq('id',user.id).select('id')
   if(error||!data?.length){await supabase.storage.from('avatars').remove([image.path]);throw error||new Error('Your profile is unavailable. Contact support.')}
   setPhoto(image.url);onSaved(image.url);setMessage('Profile picture saved. It is now shown on your profile.')
  }catch(e){setError(e.message)}finally{setBusy(false);e.target.value=''}
 }
 return <section className="card p-5 mb-6"><h2 className="font-bold mb-3">Profile picture</h2><div className="flex gap-4 items-center">{photo?<img src={photo} alt="Your current profile" className="w-20 h-20 rounded-full object-cover"/>:<span className="w-20 h-20 rounded-full bg-violet-800 grid place-items-center text-2xl" aria-label="No profile photo">{user.email?.[0]?.toUpperCase()}</span>}<div className="flex-1"><label className="text-sm">Upload your picture<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||!isSupabaseConfigured} onChange={upload}/></label><p className="text-xs text-violet-300 mt-2">JPG, PNG or WebP · up to 5 MB. Photos use a public URL; do not upload private documents.</p></div></div>{busy&&<p role="status" className="text-sm mt-3">Uploading and saving…</p>}{message&&<p role="status" className="text-sm mt-3">{message}</p>}{error&&<p role="alert" className="text-rose-300 mt-3">{error}</p>}</section>
}
