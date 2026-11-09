// Owner-approved base rates; longer durations extrapolate the 24h -> 48h increment.
// Configuration only: never use client-side prices to authorize a debit or feed eligibility.
export function listingPriceForDays(days){
 if(!Number.isInteger(days)||days<1||days>30)throw new RangeError('Choose 1 to 30 whole days.')
 return 2400+(days-1)*2200
}
export const feedListingPackages=Object.freeze([
 {key:'7h',label:'7 hours',durationHours:7,costDC:1200},
 ...[[1,'24 hours'],[2,'48 hours'],[3,'72 hours'],[7,'1 week'],[14,'2 weeks'],[21,'3 weeks'],[30,'1 month (30 days)']].map(([days,label])=>({key:`${days}d`,label,durationHours:days*24,costDC:listingPriceForDays(days)})),
].map(Object.freeze))
