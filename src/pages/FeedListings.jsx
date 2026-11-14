import {Link} from 'react-router-dom'
import FeedListingInfo from '../components/FeedListingInfo'
import './simpleProfile.css'
export default function FeedListings(){
 return <main className="simple-profile feed-listing-page"><div className="member-page-heading"><div><p className="member-eyebrow">YOUR PROFILE · YOUR NEXT CONNECTION</p><h1>List my profile.</h1><p>Your saved profile is all you need. Make it public, choose a duration, and confirm once—no second profile form.</p></div><Link className="member-primary" to="/settings">Edit my profile →</Link></div><FeedListingInfo guided/></main>
}
