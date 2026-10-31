import {MemberProvider} from './MemberContext'
import MemberLayout from './MemberLayout'
export default function MemberShell({children}){return <MemberProvider><MemberLayout>{children}</MemberLayout></MemberProvider>}
