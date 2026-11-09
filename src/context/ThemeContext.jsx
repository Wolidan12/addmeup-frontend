import {createContext,useContext,useEffect,useState} from 'react'
const ThemeContext=createContext(null)
export const useTheme=()=>useContext(ThemeContext)
export function ThemeProvider({children}){
 const [theme,setTheme]=useState(()=>document.documentElement.dataset.theme==='light'?'light':'dark')
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='light'?'#ffffff':'#07080c';try{localStorage.setItem('danqel_theme',theme)}catch{/* Still usable when storage is unavailable. */}},[theme])
 useEffect(()=>{const sync=e=>{if(e.key==='danqel_theme')setTheme(e.newValue==='light'?'light':'dark')};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[])
 return <ThemeContext.Provider value={{theme,toggle:()=>setTheme(t=>t==='light'?'dark':'light')}}>{children}</ThemeContext.Provider>
}
