/** Faithful crops of the owner-supplied Danqel artwork, shared by every app shell. */
export default function BrandLogo({name='Danqel Social Boost'}){
 return <span className="danqel-brand" role="img" aria-label={name}>
  <img className="danqel-brand-symbol" src="/brand/danqel-mark.webp" width="48" height="48" alt="" aria-hidden="true" decoding="async"/>
  <img className="danqel-brand-wordmark" src="/brand/danqel-wordmark.webp" width="186" height="49" alt="" aria-hidden="true" decoding="async"/>
 </span>
}
