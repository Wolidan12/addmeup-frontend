import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {ArrowRight,CheckCircle2,Flame,Sparkles,ShieldCheck} from 'lucide-react'
import WorkspaceNav from '../components/WorkspaceNav'
import {withTimeout,publicError} from '../lib/errors'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/AuthContext'
import {useMember} from '../member/MemberContext'
import './boosters.css'

export default function Boosters(){
 const {user}=useAuth(),{data,refresh}=useMember(),[plans,setPlans]=useState([]),[history,setHistory]=useState([]),[total,setTotal]=useState(0),[page,setPage]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[selected,setSelected]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[version,setVersion]=useState(0),dialog=useRef(null),request=useRef(null)
 const isSuperAdmin=data?.role==='super_admin'

 useEffect(()=>{
  let active=true
  setLoading(true);setError('')
  withTimeout(Promise.all([
   supabase.from('boost_plans').select('*').eq('is_active',true).order('cost_points').limit(100),
   supabase.from('user_boosts').select('*',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).range(page*10,page*10+9),
  ])).then(([p,h])=>{
   if(!active)return
   if(p.error||h.error)throw p.error||h.error
   setPlans(p.data);setHistory(h.data);setTotal(h.count||0)
  }).catch(e=>{if(active)setError(publicError(e,'Booster packages could not be loaded. Please retry.'))}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[user.id,page,version])

 useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal()},[selected])

 async function activate(e){
  e.preventDefault();if(busy||!selected)return
  setBusy(true);setError('')
  try{
   const {error}=await withTimeout(supabase.rpc('activate_point_boost',{p_plan:selected.id,p_request:request.current}))
   if(error)throw error
   setSelected(null)
   setMessage('Booster activated. Only eligible check-ins and tasks can earn the capped bonus; connection rewards are unchanged.')
   await refresh();setVersion(v=>v+1)
  }catch(e){setError(publicError(e,'The booster could not be activated. Check your DC balance and retry the same request.'))}
  finally{setBusy(false)}
 }

 const active=data?.active_boost
 const date=value=>value?new Date(value).toLocaleString():'—'
 const choose=plan=>{request.current=crypto.randomUUID();setError('');setSelected(plan)}

 return <main className="points-booster-page">
  <WorkspaceNav/>
  <div className="member-page-heading">
   <div><p className="member-eyebrow">POINTS BOOST · CAPPED REWARDS</p><h1>Points boost.</h1><p>Choose a plan to multiply eligible check-ins and task rewards. Free connections stay unchanged.</p></div>
   <div className="booster-heading-actions">
    <span className="member-page-icon"><Flame size={26}/></span>
    {isSuperAdmin&&<Link className="btn2 booster-admin-link" to="/admin?view=boost_plans">Manage booster packages <ArrowRight size={15}/></Link>}
   </div>
  </div>

  <section className="member-boost-banner" aria-label="Points booster status">
   <div>
    <span className="member-small-pill"><Sparkles size={13}/> POINTS BOOSTER</span>
    <h2>{active?`${active.multiplier}× boost active`:'Give eligible rewards a boost.'}</h2>
    <p>{active?`${active.plan_title} expires ${date(active.expires_at)}. ${Number(active.bonus_used).toLocaleString()} of ${Number(active.bonus_cap).toLocaleString()} bonus DC used.`:'Pick an available package, confirm its DC cost, and receive extra DC on eligible daily check-ins and tasks while it is active.'}</p>
    <p className="booster-banner-note">Connection rewards remain at their existing 7 DC rules. Boosters do not multiply connections, purchases, or other non-eligible rewards.</p>
   </div>
   <Flame size={84} strokeWidth={1.2} aria-hidden="true"/>
  </section>

  {error&&!selected&&<p className="member-error" role="alert">{error} <button onClick={()=>setVersion(v=>v+1)}>Retry</button></p>}
  {message&&<p className="member-notice" role="status">{message}</p>}

  <div className="member-section-heading booster-package-heading">
   <div><h2>Choose a package</h2><p>Each package shows its price, duration and maximum bonus before you confirm.</p></div>
   <Link to="/wallet">View DC wallet <ArrowRight size={15}/></Link>
  </div>

  {loading?<p role="status" className="member-empty">Loading booster packages…</p>:plans.length?
   <div className="member-plan-grid" aria-label="Available points booster packages">
    {plans.map(plan=><article className="member-plan" key={plan.id}>
     <span className="member-plan-multiplier">{plan.multiplier}×</span>
     <h3>{plan.title}</h3>
     <p className="member-plan-price">{Number(plan.cost_points).toLocaleString()}<span>DC</span></p>
     <ul>
      <li><CheckCircle2 size={16}/>{plan.duration_hours} hours from activation</li>
      <li><CheckCircle2 size={16}/>Up to {Number(plan.bonus_cap).toLocaleString()} extra DC</li>
      <li><CheckCircle2 size={16}/>Eligible check-ins and tasks only</li>
      <li><CheckCircle2 size={16}/>No stacking; no connection multiplier</li>
     </ul>
     <button className="member-primary" disabled={!data||!!active||busy||data?.restricted} onClick={()=>choose(plan)}>{active?'Booster already active':'Review package'} <ArrowRight size={15}/></button>
    </article>)}
   </div>:
   <section className="member-panel member-empty booster-empty">
    <Flame size={28}/><h3>No active booster packages</h3>
    <p>Regular eligible rewards remain available. A booster will appear here after an authorized administrator configures and publishes a package.</p>
    {isSuperAdmin?<Link className="member-primary" to="/admin?view=boost_plans">Create or publish a package <ArrowRight size={15}/></Link>:<Link to="/rewards">View eligible rewards <ArrowRight size={15}/></Link>}
   </section>}

  <section className="member-panel booster-how" aria-labelledby="booster-how-title">
   <div className="booster-how-heading"><div><h2 id="booster-how-title">How does Points boost work?</h2><p>Clear package terms; no changes to connection rewards.</p></div><ShieldCheck size={24} aria-hidden="true"/></div>
   <ol className="booster-how-steps">
    <li><span>01</span><div><strong>Choose a package</strong><p>Review the DC price, multiplier, duration and bonus cap before activating.</p></div></li>
    <li><span>02</span><div><strong>Earn eligible rewards</strong><p>Only supported daily check-ins and tasks use the active multiplier. Connections stay free and unchanged.</p></div></li>
    <li><span>03</span><div><strong>Stay within the cap</strong><p>Extra DC stops at the package limit. The boost expires at the shown time and does not stack.</p></div></li>
   </ol>
  </section>

  <section className="member-panel mt-7 booster-history">
   <div className="member-panel-title"><div><h2>Your booster history</h2><p>Activation records and the original package terms from the database.</p></div></div>
   <div className="member-table-wrap"><table><thead><tr><th>Package</th><th>Multiplier</th><th>Cost</th><th>Bonus earned</th><th>Expires</th></tr></thead><tbody>{!loading&&history.map(item=><tr key={item.id}><td>{item.plan_title}</td><td>{item.multiplier}×</td><td>{Number(item.cost_points).toLocaleString()} DC</td><td>{Number(item.bonus_used).toLocaleString()} / {Number(item.bonus_cap).toLocaleString()} DC</td><td>{date(item.expires_at)}</td></tr>)}</tbody></table></div>
   {!loading&&!history.length&&<p className="member-empty">No booster activations yet.</p>}
   <div className="member-pagination"><span>Page {page+1} · {total} activations</span><div><button disabled={loading||page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={loading||(page+1)*10>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
  </section>

  {selected&&<dialog ref={dialog} className="member-dialog" aria-labelledby="activate-title" onCancel={e=>{if(busy)e.preventDefault();else setSelected(null)}}>
   <form onSubmit={activate}>
    <span className="member-page-icon"><Flame size={25}/></span>
    <h2 id="activate-title">Activate {selected.title}?</h2>
    <p>Spend <strong>{Number(selected.cost_points).toLocaleString()} DC</strong> to multiply eligible check-in and task rewards by <strong>{selected.multiplier}×</strong> for {selected.duration_hours} hours, up to {Number(selected.bonus_cap).toLocaleString()} extra DC.</p>
    <p>Activation starts immediately. The package cost is deducted once. Connection rewards are not multiplied. Unused bonus expires; no cash value or guaranteed earnings.</p>
    <label className="member-check"><input className="w-auto" type="checkbox" required/>I understand the package cost, duration, eligible rewards and bonus cap.</label>
    {error&&<p role="alert" className="member-error">{error}</p>}
    <div className="member-dialog-actions"><button type="button" disabled={busy} onClick={()=>setSelected(null)}>Cancel</button><button className="member-primary" disabled={busy}>{busy?'Activating…':'Confirm activation'}</button></div>
   </form>
  </dialog>}
 </main>
}
