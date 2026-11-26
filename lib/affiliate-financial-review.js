// Read-only owner review. No financial obligation is created here.
function decimal(value, places) {
  const raw=String(value??'');
  if(!/^\d{1,12}(?:\.\d{1,4})?$/.test(raw))return null;
  const [whole,fraction='']=raw.split('.');
  if(fraction.length>places && /[1-9]/.test(fraction.slice(places)))return null;
  return BigInt(whole)*10n**BigInt(places)+BigInt(fraction.slice(0,places).padEnd(places,'0')||'0');
}
const centsText=cents=>String(cents/100n)+'.'+String(cents%100n).padStart(2,'0');

export function reviewAffiliateBooking(booking, partner, existing=[]) {
  const reasons=[];
  const currency=String(booking?.currency||'').trim();
  const eligible=decimal(booking?.net_room_revenue,2);
  const rate=decimal(partner?.rate,4);
  if(!partner||partner.id!==booking?.affiliate_id||partner.status!=='active')reasons.push('Active attributed partner required');
  if(!['CHECKED_OUT','COMPLETED'].includes(String(booking?.status||'').toUpperCase()))reasons.push('Stay not completed');
  if(String(booking?.payment_status||'').toUpperCase()!=='PAID')reasons.push('Payment not fully recorded');
  if(eligible===null||eligible<=0n)reasons.push('Net room revenue missing or invalid');
  if(!/^[A-Z]{3}$/.test(currency))reasons.push('Currency missing or invalid');
  if(partner?.rate_approval_status!=='approved'||rate===null||rate<=0n||rate>10000n)reasons.push('Owner-approved rate required');
  if(existing.some(r=>r.booking_id===booking?.id&&r.affiliate_id===booking?.affiliate_id&&r.commission_type==='referral'))reasons.push('Commission already recorded');
  // A draft is deliberately not payable. Owner must verify payment evidence,
  // refunds, eligibility and commercial terms separately before posting.
  return {bookingId:booking?.id,reference:booking?.booking_reference,partnerName:partner?.name||'Unknown partner',
    status:booking?.status,currency:currency||null,eligibleAmount:eligible===null?null:centsText(eligible),
    proposedAmount:reasons.length?null:centsText((eligible*rate+5000n)/10000n),
    reasons,requiresReconciliation:true};
}
