// Display server decisions only. This module never calculates or credits a balance.
export function relationshipMessage(result){
 if(result?.action==='connect'&&result.enabled){
  if(result.reward_dc===7&&result.reward_status==='granted')return 'Connected! +7 reward DC added to your wallet. Reward DC cannot pay listing fees.'
  if(result.reward_status==='daily_cap')return 'Connected for free. You reached today’s 50 rewarded connections (350 DC). Rewards reset at midnight UTC; this pair will not earn a later reward.'
  if(result.reward_status==='already_processed')return 'Connected for free. This pair was already processed; reconnecting does not earn another reward.'
  if(result.reward_status==='paused')return 'Connected for free. Connection rewards are temporarily paused.'
  return 'Connected for free. No new reward was confirmed.'
 }
 if(result?.action==='connect')return 'Disconnected. Previous rewards are unchanged; reconnecting does not earn another reward.'
 if(result?.action==='block')return result.enabled?'Account blocked. Connections and favourites were removed; no reward was granted.':'Account unblocked. No reward was granted.'
 return result?.enabled?'Profile saved for free. Saving does not earn DC.':'Profile removed from favourites. No DC changed.'
}
