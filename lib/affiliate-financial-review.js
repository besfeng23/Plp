// Owner-only planning calculations. This module never posts a commission or moves money.
function cents(value,scale=2){
  if(value===null||value===undefined)return null;
  const s=String(value);
  const m=s.match(/^(\d+)(?:\.(\d+))?$/);
  if(!m||m[1].length>12||(m[2]||'').length>scale)return null;
  return BigInt(m[1])*10n**BigInt(scale)+BigInt((m[2]||'').padEnd(scale,'0')||'0');
}
const money=n=>(n/100n).toString()+'.'+(n%100n).toString().padStart(2,'0');
export function reviewCommission(booking,partner,existing=[]){
  const reasons=[];
  const base=cents(booking.net_room_revenue);
  const rate=cents(partner?.rate,4);
  const currency=String(booking.currency||'').toUpperCase();
  if(!partner||partner.id!==booking.affiliate_id||partner.status!=='active')reasons.push('Active attributed partner required');
  if(booking.status!=='CHECKED_OUT')reasons.push('Stay must be checked out');
  if(booking.payment_status!=='PAID'||!booking.balance_paid_at)reasons.push('Full payment requires reconciliation');
  if(!['USD','PHP'].includes(currency))reasons.push('Explicit supported currency required');
  if(base===null||base<=0n)reasons.push('Net room revenue not recorded');
  if(rate===null||rate<0n||rate>10000n)reasons.push('Valid proposed rate required');
  if(partner?.rate_approval_status!=='approved')reasons.push('Rate not approved');
  if(existing.some(r=>r.booking_id===booking.id&&r.affiliate_id===booking.affiliate_id&&r.commission_type==='referral'))reasons.push('Commission already recorded');
  const amount=base!==null&&rate!==null&&rate<=10000n&&['USD','PHP'].includes(currency)?money((base*rate+5000n)/10000n):null;
  return {reference:booking.booking_reference,partner:partner?.name||'Unavailable',currency:currency||null,netRevenue:base===null?null:money(base),rate:rate===null?null:Number(rate)/10000,illustrativeAmount:amount,reasons,postingAllowed:false};
}
export function reviewSettlement(rows){
  const groups=new Map();
  for(const r of rows){
    const value=cents(r.commission_amount),currency=String(r.currency||'');
    if(!['approved','payable'].includes(r.status)||r.payout_id||value===null||!['USD','PHP'].includes(currency))continue;
    const key=r.affiliate_id+':'+currency;
    const g=groups.get(key)||{affiliateId:r.affiliate_id,currency,amount:0n,records:0};
    g.amount+=value;g.records++;groups.set(key,g);
  }
  return [...groups.values()].map(g=>({...g,amount:money(g.amount),postingAllowed:false}));
}
