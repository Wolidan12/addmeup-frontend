// Login return paths must remain on this site, even if history state is modified.
export function loginDestination(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(value))return '/dashboard'
 if(/^\/(login|register|forgot-password|reset-password)(\/|\?|#|$)/.test(value))return '/dashboard'
 return value
}
