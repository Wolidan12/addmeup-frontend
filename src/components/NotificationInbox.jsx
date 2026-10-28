import {publicError} from '../lib/errors'
import {useCallback,useEffect,useState} from 'react'
import {useAuth} from '../context/AuthContext'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
export default function NotificationInbox(){
 const {user}=useAuth(),[rows,setRows]=useState([]),[page,setPage]=useState(0),[total,setTotal]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(null)
 const load=useCallback(async()=>{
  if(!isSupabaseConfigured||!user)return
  setBusy(true);setError('')
  try{const {data,count,error}=await supabase.from('notifications').select('*',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).range(page*10,page*10+9);if(error)throw error;setRows(data);setTotal(count)}catch(e){setError(publicError(e))}finally{setBusy(false)}
 },[user,page])
 useEffect(()=>{load()},[load])
 if(!isSupabaseConfigured)return null
 async function read(id){setSaving(id);setError('');try{const {data,error}=await supabase.from('notifications').update({is_read:true}).eq('id',id).eq('user_id',user.id).select('id');if(error)throw error;if(!data?.length)throw new Error('Notification is no longer available');setRows(items=>items.map(r=>r.id===id?{...r,is_read:true}:r))}catch(e){setError(publicError(e))}finally{setSaving(null)}}
 return <section className="card p-5 mt-10" aria-labelledby="inbox-title"><div className="flex justify-between gap-3 items-center"><h2 id="inbox-title" className="font-bold">Your notifications</h2><button className="btn2 text-xs" disabled={busy} onClick={load}>Refresh</button></div>
 {error&&<p role="alert" className="text-rose-300 mt-3">{error}</p>}{busy?<p role="status" className="py-6 text-sm">Loading notifications…</p>:rows.length? <ul>{rows.map(r=><li key={r.id} className="border-t border-violet-900 py-4 mt-3"><div className="flex justify-between gap-3"><h3 className="font-semibold">{!r.is_read&&<span className="text-violet-400" aria-label="Unread">● </span>}{r.title}</h3><time className="text-xs text-violet-300" dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString()}</time></div><p className="text-sm mt-2 whitespace-pre-wrap break-words">{r.body}</p>{!r.is_read&&<button className="btn2 text-xs mt-3" disabled={saving!==null} onClick={()=>read(r.id)}>{saving===r.id?'Saving…':'Mark as read'}</button>}</li>)}</ul>:<p className="py-6 text-sm text-violet-300">No notifications yet.</p>}
 <div className="flex justify-between gap-3 items-center mt-3 text-xs"><span>Page {page+1} · {total} notifications</span><div className="flex gap-2"><button className="btn2" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="btn2" disabled={busy||(page+1)*10>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></div></section>
}
