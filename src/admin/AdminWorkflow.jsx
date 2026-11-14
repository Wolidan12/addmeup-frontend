import {useState} from 'react'
import {resources,canView,formatLabel,cardQuickActions} from './resources'
import {adminSections} from './sections'

export function AdminShortcuts({role,tab,onNavigate}){
 const items=[['overview','Home'],['bank_point_orders','Deposits'],['profiles','Users'],['support_tickets','Support']].filter(([key])=>key==='overview'||canView(role,resources.find(r=>r.key===key)))
 return <nav className="admin-shortcuts" aria-label="Daily admin tasks">{items.map(([key,label])=><button type="button" key={key} aria-current={tab===key?'page':undefined} onClick={()=>onNavigate(key)}>{label}</button>)}</nav>
}
export function AdminToolSearch({role,onNavigate}){
 const [query,setQuery]=useState('')
 const tools=[...adminSections.flatMap(([label,key,children])=>[[key,label],...children.map(k=>[k,resources.find(r=>r.key===k)?.label])]),...(role==='super_admin'?[['bot_generator','Bot Generator'],['reseller','Manual Reseller']]:[])].filter(([key,label])=>label&&(key==='overview'||['bot_generator','reseller'].includes(key)||canView(role,resources.find(r=>r.key===key))))
 return <div className="admin-tool-search"><label htmlFor="admin-tool-query">Find an admin tool</label><input id="admin-tool-query" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Users, deposits, wallets…"/>{query.trim()&&<div className="admin-tool-results">{tools.filter(([,label])=>label.toLowerCase().includes(query.trim().toLowerCase())).map(([key,label])=><button key={key} type="button" onClick={()=>{setQuery('');onNavigate(key)}}>{label}</button>)}{!tools.some(([,label])=>label.toLowerCase().includes(query.trim().toLowerCase()))&&<p role="status">No matching tool. Try users, deposits or support.</p>}</div>}</div>
}
export function RecordFields({record,display}){
 return <dl className="admin-readable-fields">{Object.entries(record).map(([key,value])=><div key={key}><dt>{formatLabel(key)}</dt><dd>{value&&typeof value==='object'?Array.isArray(value)&&value.every(v=>typeof v!=='object')?value.join(', ')||'—':<details><summary>View {formatLabel(key)}</summary>{Array.isArray(value)?value.map((entry,i)=><pre key={i}>{JSON.stringify(entry,null,2)}</pre>):<RecordFields record={value} display={display}/>}</details>:display(key,value)}</dd></div>)}</dl>
}
export function AdminRecordCards({rows,resource,role,actorId,display,busy,onOpen,onAction}){
 return <div className="admin-record-cards" aria-busy={busy}>{rows.map((row,i)=>{
  const title=row.display_name||row.username||row.subject||row.title||row.label||row.code||row.email||resource.label
  const fields=resource.columns.filter(k=>!['id','user_id','display_name','username','title','subject','status'].includes(k)).slice(0,4)
  const quickActions=cardQuickActions(resource.key,row,role,actorId)
  return <article className="admin-record-card" key={row.id||row.user_id||row.key||i}><header><h3>{title}</h3>{row.status&&<span className="ad-status">{formatLabel(row.status)}</span>}</header>{row.username&&row.display_name&&<p>@{row.username}</p>}<dl>{fields.map(k=><div key={k}><dt>{formatLabel(k)}</dt><dd>{display(k,row[k])}</dd></div>)}</dl><footer><button disabled={busy} onClick={()=>onOpen(row)}>{resource.key==='profiles'?'Open user':'Details & actions'}</button>{quickActions.map(quick=><button key={quick.action} disabled={busy} onClick={()=>onAction({...quick,row})}>{quick.label}</button>)}</footer></article>
 })}</div>
}
