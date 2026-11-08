import {useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {publicError,withTimeout} from '../../lib/errors'
import {missingBackend} from '../../lib/backendAvailability'
import {verifyBotOwner} from './ownerAccess'
import {useAuth} from '../../context/AuthContext'
import {Link,useNavigate} from 'react-router-dom'
import './botgen.css'

export default function BotGenerator({refreshToken=0}){
 const {signOut}=useAuth(),navigate=useNavigate()
 const [view,setView]=useState('templates'),[access,setAccess]=useState('loading'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[templates,setTemplates]=useState([]),[bots,setBots]=useState([]),[events,setEvents]=useState([]),[total,setTotal]=useState(null),[page,setPage]=useState(0),[search,setSearch]=useState(''),[category,setCategory]=useState(''),[edit,setEdit]=useState(null),[name,setName]=useState(''),[configuration,setConfiguration]=useState({})
 const generation=useRef(0),saveId=useRef(null),editor=useRef(null)
 const load=useCallback(async()=>{
  const request=++generation.current;setBusy(true);setError('')
  try{
   const owner=await verifyBotOwner(supabase)
   if(!owner){if(request===generation.current){setAccess('denied');setBots([]);setTemplates([]);setEvents([]);setTotal(null);setEdit(null)}return}
   const [catalog,records,audit]=await withTimeout(Promise.all([
    supabase.from('botgen_templates').select('*').order('id'),
    supabase.from('botgen_bots').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(page*25,page*25+24),
    supabase.from('botgen_audit').select('id,bot_id,action,created_at').order('created_at',{ascending:false}).order('id').limit(25)
   ]))
   if(catalog.error||records.error||audit.error)throw catalog.error||records.error||audit.error
   if(!Array.isArray(catalog.data)||!Array.isArray(records.data)||!Array.isArray(audit.data)||!Number.isSafeInteger(records.count)||records.count<0)throw new Error('Invalid automation response')
   if(request===generation.current){setAccess('owner');setTemplates(catalog.data);setBots(records.data);setEvents(audit.data);setTotal(records.count)}
  }catch(e){if(request===generation.current){setAccess(missingBackend(e)?'pending':'error');setError(publicError(e,'Automation records could not be loaded.'));setBots([]);setTemplates([]);setEvents([]);setTotal(null);setEdit(null)}}finally{if(request===generation.current)setBusy(false)}
 },[page])
 useEffect(()=>{load();return()=>{generation.current++}},[load,refreshToken])
 useEffect(()=>{if(edit){editor.current?.scrollIntoView({block:'start',behavior:'smooth'});editor.current?.querySelector('input')?.focus({preventScroll:true})}},[edit])
 function configure(template,bot){if(!template)return;saveId.current=bot?.id||crypto.randomUUID();setEdit(template);setName(bot?.name||'');setConfiguration(bot?.configuration||{});setNotice('');setError('')}
 async function save(e){e.preventDefault();if(access!=='owner'||busy)return;setBusy(true);setError('')
  try{const {error}=await withTimeout(supabase.rpc('botgen_save',{p_id:saveId.current,p_template:edit.id,p_name:name.trim(),p_configuration:configuration}));if(error)throw error;setEdit(null);setNotice('Configuration saved. This bot has not been activated.');setView('bots');await load()}catch(e){setError(publicError(e,'Configuration could not be saved. No execution was started.'))}finally{setBusy(false)}
 }
 async function remove(bot){if(!window.confirm('Permanently delete this configuration? The audit record will be retained.'))return;setBusy(true);setError('')
  try{const {error}=await withTimeout(supabase.rpc('botgen_delete',{p_id:bot.id}));if(error)throw error;setNotice('Configuration deleted; audit retained.');await load()}catch(e){setError(publicError(e,'The configuration could not be deleted.'))}finally{setBusy(false)}
 }
 function exportMetadata(bot){
  // Deliberately exclude free-text configuration, credentials and private records.
  const content=JSON.stringify({format:'danqel-bot-metadata-v1',id:bot.id,name:bot.name,template_id:bot.template_id,status:bot.status,created_at:bot.created_at},null,2)
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`danqel-bot-${bot.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Metadata exported. Configuration text and integration credentials are excluded.')
 }
 async function logout(){setBusy(true);setError('');try{await signOut();navigate('/admin/bots/login',{replace:true})}catch(e){setError(publicError(e,'Sign-out failed. Please retry.'))}finally{setBusy(false)}}
 if(access==='denied')return <section className="ad-panel"><h2>Owner authorization required</h2><p>This module requires a separately provisioned owner grant as well as super-admin access. It cannot be enabled by changing browser state.</p><button disabled={busy} onClick={load}>Recheck access</button><Link to="/admin/bots/login">Use owner sign in</Link></section>
 if(access!=='owner')return <section className="bg-control"><span className="bg-terminal">DANQEL // PRIVATE AUTOMATION</span><h2>Owner service unavailable</h2><p role="status">{access==='loading'?'Verifying owner authorization…':'Access is locked until the server verifies owner authorization. No bot records or controls are available.'}</p>{error&&<p role="alert">{error}</p>}<div className="bg-tabs"><button disabled={busy} onClick={load}>Retry owner verification</button><Link to="/admin/bots/login">Owner sign in</Link></div></section>
 const catalogue=templates
 const visible=catalogue.filter(t=>(!category||t.category===category)&&(t.name+' '+t.description).toLowerCase().includes(search.toLowerCase()))
 return <section className="bg-control" aria-label="Danqel Bot Generator"><header className="bg-hero"><div><span className="bg-terminal">DANQEL // PRIVATE AUTOMATION</span><h2>BOT GENERATOR</h2><p>Configure intentionally. Execute accountably.</p></div><span className="bg-badge">{access==='owner'?'OWNER VERIFIED':access==='loading'?'CHECKING ACCESS':'SETUP PENDING'}</span></header>
 <div className="bg-notice"><strong>Configuration foundation · execution unavailable</strong><p>No worker or WhatsApp connection is installed by this feature. Saving a bot does not run it. No fake views, engagement promises, unofficial WhatsApp automation or unsolicited broadcasts.</p></div>
 {access==='pending'&&<p role="status">The gated backend foundation and trusted owner grant must be installed after verified recovery. Below are bundled template definitions, not live bots or database statistics.</p>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <nav className="bg-tabs" aria-label="Bot workspace"><button disabled={busy} onClick={logout}>Sign out of Bot Generator</button>{[['templates','Templates'],['bots','My bots'],['audit','Audit trail']].map(([id,label])=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>{setView(id);setEdit(null)}}>{label}</button>)}<button disabled={busy} onClick={load}>{busy?'Loading…':'Refresh automation'}</button></nav>
 <div className="bg-stats"><article><span>Database templates</span><strong>{access==='owner'?templates.length:'—'}</strong></article><article><span>Saved configurations</span><strong>{total??'—'}</strong></article><article><span>Execution / WhatsApp</span><strong>Not installed</strong></article></div>
 {view==='templates'&&<><div className="bg-filters"><label>Search templates<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={200}/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{[...new Set(catalogue.map(t=>t.category))].map(c=><option key={c}>{c}</option>)}</select></label></div><div className="bg-cards">{visible.map(t=><article key={t.id}><span className="bg-terminal">{t.id} / {t.category}</span><h3>{t.name}</h3><p>{t.description}</p><ul>{t.features.map(f=><li key={f}>{f}</li>)}</ul><details><summary>Requirements and documentation</summary><p>{t.documentation}</p><ul>{t.permissions.map(p=><li key={p}>{p}</li>)}</ul><p>Handler identifier: {t.handler}. Not executable in this phase.</p></details><button disabled={busy||access!=='owner'} onClick={()=>configure(t)}>Configure bot</button></article>)}</div>{!visible.length&&<p>No matching templates.</p>}</>}
 {view==='bots'&&<><p>Saved configurations only. Activation, pause, stop, restart, schedules and execution counts will require a verified worker service.</p>{access!=='owner'?<p>Records unavailable until owner access and backend setup are verified.</p>:!busy&&!bots.length?<p>No configurations on this page.</p>:bots.map(bot=><article className="bg-record" key={bot.id}><h3>{bot.name}</h3><p>{templates.find(t=>t.id===bot.template_id)?.name||bot.template_id} · {bot.status}</p><code>{bot.id}</code><p>Created {new Date(bot.created_at).toLocaleString()}</p><div className="bg-tabs"><button disabled={busy} onClick={()=>configure(templates.find(t=>t.id===bot.template_id),bot)}>Edit configuration</button><button disabled={busy} onClick={()=>exportMetadata(bot)}>Export metadata</button><button disabled={busy} onClick={()=>remove(bot)}>Delete configuration</button></div></article>)}<div className="bg-tabs"><button disabled={busy||page===0||access!=='owner'} onClick={()=>setPage(p=>p-1)}>Previous bots</button><span>Page {page+1} · {total??'—'} configurations</span><button disabled={busy||total===null||(page+1)*25>=total||access!=='owner'} onClick={()=>setPage(p=>p+1)}>Next bots</button></div></>}
 {view==='audit'&&<><h3>Latest 25 configuration events</h3><p>These are configuration changes, not execution results. Audit records remain after deletion.</p>{access!=='owner'?<p>Audit unavailable until access is verified.</p>:!events.length?<p>No recorded configuration changes.</p>:events.map(event=><article className="bg-record" key={event.id}><strong>{event.action}</strong><p>Bot {event.bot_id}</p><time>{new Date(event.created_at).toLocaleString()}</time></article>)}</>}
 {edit&&<form ref={editor} className="bg-editor" onSubmit={save}><h3>{name?'Edit configuration':'New configuration'} · {edit.name}</h3><p>Do not put tokens, passwords or private API credentials in these fields.</p><label>Bot name<input required minLength={3} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>{edit.fields.map(field=><label key={field.key}>{field.label}<textarea aria-label={field.label} required={field.required} maxLength={field.maxLength} value={configuration[field.key]||''} onChange={e=>setConfiguration({...configuration,[field.key]:e.target.value})}/></label>)}<div className="bg-tabs"><button disabled={busy} type="submit">Save configuration</button><button disabled={busy} type="button" onClick={()=>setEdit(null)}>Cancel editing</button></div></form>}
 </section>
}
