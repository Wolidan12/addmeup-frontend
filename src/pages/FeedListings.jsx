import {Link} from 'react-router-dom'
import FeedListingInfo from '../components/FeedListingInfo'
import './simpleProfile.css'
export default function FeedListings(){
 return <main className="simple-profile feed-listing-page"><div className="member-page-heading"><div><p className="member-eyebrow">YOUR PROFILE · YOUR NEXT CONNECTION</p><h1>List my profile.</h1><p>Use your launch reward or purchased DC to reach the community. Follow the steps below—no repeated profile details.</p></div><Link className="member-primary" to="/settings">Edit my profile →</Link></div><FeedListingInfo guided/></main>
}
