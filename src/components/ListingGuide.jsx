import {Link} from 'react-router-dom'

const steps=[
 {title:'Use your saved profile',body:'Your signup username and saved profile are reused. No new account or repeated profile form.',link:'/settings',action:'Review my profile'},
 {title:'Make it public',body:'Turn on public profile and share at least one supported social link publicly. Refresh status after saving.',link:'/settings',action:'Set profile & link public'},
 {title:'Choose time below',body:'Pick a duration, check the price and confirm once. Only purchased DC and your unspent 5,000 DC first-50 launch reward count; 7-DC connection rewards do not.',link:'#feed-listing-options',action:'Choose a duration'}
]
export default function ListingGuide({ready,inFeed,onRefresh}){
 const state=ready===undefined?'Checking readiness…':inFeed?'Live in the feed':ready?'Ready to list':'Set up your public profile'
 return <section className="listing-guide" aria-labelledby="listing-guide-title">
  <div className="listing-guide-heading"><div><p className="member-eyebrow">YOUR PROFILE · THREE QUICK STEPS</p><h2 id="listing-guide-title">List your profile in the feed.</h2></div><span className="listing-guide-state">{state}</span></div>
  <ol className="listing-guide-steps" aria-label="How to list your profile">{steps.map((step,index)=><li key={step.title}>
   <span className="listing-guide-number" aria-hidden="true">0{index+1}</span><h3>{step.title}</h3><p>{step.body}</p>
   {index===1?<><Link to={step.link}>{step.action} →</Link><button type="button" onClick={onRefresh}>I saved my changes · refresh status</button></>:<Link to={step.link}>{step.action} →</Link>}
  </li>)}</ol>
  <p className="listing-guide-note">Saving your profile is free. Your listing clock keeps running while your profile or public links are hidden. No automatic renewal.</p>
 </section>
}
