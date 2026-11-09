import {useCallback,useEffect,useRef,useState} from 'react'
// Server remains authoritative. Hide known-expired cards immediately and re-read on
// expiry/visibility/30s polling; use server clock offset rather than device clock alone.
export function useFeedRefresh(){
 const [tick,setTick]=useState(0),offset=useRef(0),timer=useRef(null)
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')setTick(t=>t+1)};const interval=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(interval);clearTimeout(timer.current);document.removeEventListener('visibilitychange',refresh)}},[])
 const track=useCallback(data=>{clearTimeout(timer.current);const server=Date.parse(data?.server_now);if(!Number.isFinite(server))return;offset.current=server-Date.now();const ends=(data.rows||[]).map(r=>Date.parse(r.feed_ends_at)).filter(t=>Number.isFinite(t)&&t>=server);if(ends.length)timer.current=setTimeout(()=>setTick(t=>t+1),Math.min(2147483647,Math.max(0,Math.min(...ends)-server+25)))},[])
 const visible=useCallback(row=>!row.feed_ends_at||Date.parse(row.feed_ends_at)>Date.now()+offset.current,[])
 return {tick,track,visible}
}
