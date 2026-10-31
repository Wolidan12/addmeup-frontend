import {Link2} from 'lucide-react'
export const PLATFORM_LABELS={whatsapp:'WhatsApp',snapchat:'Snapchat',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook',x:'X',youtube:'YouTube',telegram:'Telegram'}
export default function PlatformLogo({platform,size=22}){
 return <span className={`platform-logo platform-${platform}`} style={{width:size,height:size}} aria-hidden="true">{!PLATFORM_LABELS[platform]?<Link2 size={Math.round(size*.65)}/>:<img src={`/platforms/${platform}.svg`} alt="" width={Math.round(size*.65)} height={Math.round(size*.65)}/>}</span>
}
