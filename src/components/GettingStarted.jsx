import { Link } from 'react-router-dom'
import { ArrowRight, Gift } from 'lucide-react'
import '../pages/howItWorks.css'

export default function GettingStarted() {
  return (
    <section className="how-welcome" aria-label="New member guide">
      <div>
        <strong>The first 50 eligible accounts can receive 5,000 DC.</strong>
        <p>Confirm your email, add a photo, bio, country and one interest, and complete your name and username. No social link is required.</p>
      </div>
      <Link to="/rewards"><Gift size={17} /> Find my 5,000 DC launch reward</Link>
      <Link to="/how-it-works">Show me the guide <ArrowRight size={17} /></Link>
    </section>
  )
}
