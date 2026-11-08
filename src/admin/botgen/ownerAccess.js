import {withTimeout} from '../../lib/errors.js'

// Authenticated session alone is never an owner grant. No role/localStorage fallback.
export async function verifyBotOwner(client){
 const {data,error}=await withTimeout(client.rpc('botgen_is_owner'))
 if(error)throw error
 if(typeof data!=='boolean')throw new Error('Invalid owner authorization response')
 return data
}
export function isBotWorkspace(pathname,search=''){
 return pathname==='/admin/bots'||(pathname==='/admin'&&new URLSearchParams(search).get('view')==='bot_generator')
}
