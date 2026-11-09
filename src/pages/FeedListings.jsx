import {Link} from 'react-router-dom'
import FeedListingInfo from '../components/FeedListingInfo'
import './simpleProfile.css'
export default function FeedListings(){
 return <main className="simple-profile feed-listing-page"><div className="member-page-heading"><div><p className="member-eyebrow">PURCHASED DC · TIMED PLACEMENTS</p><h1>List my profile.</h1><p>One saved profile. Choose how long it appears in the feed.</p></div><Link className="member-primary" to="/settings">Edit my profile →</Link></div><FeedListingInfo/></main>
}
