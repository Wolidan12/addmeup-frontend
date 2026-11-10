import { Link } from 'react-router-dom'
import { ArrowRight, Gift } from 'lucide-react'
import '../pages/howItWorks.css'

export default function GettingStarted() {
  return (
    <section className="how-welcome" aria-label="New member guide">
      <div>
        <strong>New here? Your first 5,000 DC may be waiting.</strong>
        <p>See how it works, or check the eligibility and requirements for the first-50 launch reward.</p>
      </div>
      <Link to="/rewards"><Gift size={17} /> Find my 5,000 DC launch reward</Link>
      <Link to="/how-it-works">Show me the guide <ArrowRight size={17} /></Link>
    </section>
  )
}
