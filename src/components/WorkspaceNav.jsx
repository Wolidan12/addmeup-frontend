import {NavLink} from 'react-router-dom'
import {Compass,Wallet,Users,Flame,UserRound,Layers3,CreditCard,CalendarClock} from 'lucide-react'
export default function WorkspaceNav({community=false}){
 const links=community?[['/discover','Discovery',Compass],['/settings','My profile',UserRound]]:[['/rewards','Wallet & tasks',Wallet],['/referrals','Referrals',Users],['/boosts','Boosters',Flame],['/promotions','Promotions',Layers3],['/subscriptions','Plans',CalendarClock],['/payments','Payments',CreditCard]]
 return <nav className="workspace-route-nav" aria-label={community?'Community sections':'Rewards and commerce sections'}>{links.map(([to,title,Icon])=><NavLink to={to} key={to}><Icon size={15}/>{title}</NavLink>)}</nav>
}
