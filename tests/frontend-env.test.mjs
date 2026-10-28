import assert from 'node:assert/strict'
import {validateFrontendEnv} from '../scripts/frontend-env.mjs'
const url='https://example.supabase.co',jwt=role=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.fixture'
validateFrontendEnv({})
validateFrontendEnv({VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:'sb_publishable_fixture'})
validateFrontendEnv({VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:jwt('anon')})
for(const env of [{VITE_SECRET:'PRIVATE_SENTINEL'},{VITE_SUPABASE_URL:url},{VITE_SUPABASE_URL:'http://example.com',VITE_SUPABASE_ANON_KEY:'sb_publishable_fixture'},{VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:jwt('service_role')},{VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:'private-value-fixture'}]){
 assert.throws(()=>validateFrontendEnv(env),e=>!e.message.includes('PRIVATE_SENTINEL')&&!e.message.includes('private-value-fixture'))
}
console.log('Frontend build guard accepts public keys, rejects private/unknown/incomplete configuration without exposing values')
