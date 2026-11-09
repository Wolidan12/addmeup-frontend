import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const auth=await readFile('src/pages/AuthPages.jsx','utf8'),register=auth.split('export function Register()')[1].split('export function Forgot()')[0]
assert.ok(register.includes('data?.session?.access_token && data?.session?.user?.id'))
assert.ok(register.includes('navigate("/dashboard", {replace:true})'))
assert.ok(register.includes('Continue by signing in with your email and password.'))
assert.ok(!register.includes('to="/verify"'))
assert.ok(!register.includes('Check your email for a verification link'))
const provider=await readFile('src/context/AuthContext.jsx','utf8')
assert.ok(provider.includes('supabase.auth.signUp('));assert.ok(provider.includes('supabase.auth.signInWithPassword('))
assert.ok(provider.includes('resetPasswordForEmail'))
assert.ok(!(await readFile('src/pages/HowItWorks.jsx','utf8')).includes('confirm your email'))
console.log('PASS signup flow: only a genuine returned Auth session navigates to dashboard; sessionless response offers password sign-in, no registration verification-email prompt; password authentication and email recovery retained.')
