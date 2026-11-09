import {Sun,Moon} from 'lucide-react'
import {useTheme} from '../context/ThemeContext'
export default function ThemeToggle(){const {theme,toggle}=useTheme();return <button type="button" className="theme-toggle" onClick={toggle} aria-label={theme==='dark'?'Switch to light theme':'Switch to dark theme'} aria-pressed={theme==='light'}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{theme==='dark'?'Light mode':'Dark mode'}</span></button>}
