import {Link} from 'react-router-dom'
import {ArrowRight} from 'lucide-react'
import '../pages/howItWorks.css'

export default function GettingStarted(){
 return <section className="how-welcome" aria-label="New member guide"><div><strong>New here? See how it works.</strong><p>Try a sample profile and learn how to publish your own listing.</p></div><Link to="/how-it-works">Show me the guide <ArrowRight size={17}/></Link></section>
}
