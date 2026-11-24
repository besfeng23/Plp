import React, { useEffect, useState } from 'react';
import { PROPOSED_AFFILIATE_RATES } from '../../lib/affiliate-rates.js';

export default function AffiliateAdmin({ code, view = 'partners', refreshedAt }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', tier: 'referral' });
  const heading = view === 'payouts' ? 'Payouts' : 'Partners';

  async function load() {
    setError('');
    const query = new URLSearchParams({ action: 'affiliates', view });
    const response = await fetch('/api/admin?' + query, { cache: 'no-store', headers: { 'X-PLP-Staff-Code': code } });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || 'The partner directory is unavailable.');
    setData(body);
  }

  useEffect(() => {
    let cancelled = false;
    setData(null);
    load().catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [code, view, refreshedAt]);

  async function post(body, success) {
    setBusy(true); setNote(''); setError('');
    try {
      const response = await fetch('/api/admin?action=affiliates', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PLP-Staff-Code': code },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'The change could not be saved.');
      setNote(success(result));
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (error && !data) return <section className="plp-panel"><p role="alert">{error}</p></section>;
  if (!data) return <section className="plp-panel"><p role="status">Loading…</p></section>;

  if (view === 'payouts') {
    return <section className="plp-panel" aria-label={heading}>
      <div className="plp-panel__head"><div><h3>{heading}</h3><p>Manual payout records only. No money is moved from this screen.{data.commissionsActive ? '' : ' Commission calculation is off until the owner approves rates.'}</p></div></div>
      {error && <p className="plp-form-error" role="alert">{error}</p>}
      {note && <p role="status">{note}</p>}
      <p className="plp-disclosure">New payout recording is locked pending owner-approved commission reconciliation. Historical settlement records remain available.</p>
      <div className="plp-task-list">{(data.rows || []).length === 0 ? <p className="plp-disclosure">No payouts recorded.</p>
        : data.rows.map((row) => <article className="plp-enquiry" key={row.id}>
          <header><h4>{row.currency} {row.amount}</h4><time>{String(row.created_at || '').slice(0, 10)}</time></header>
          <p>{row.payout_reference || 'No reference'}{row.recorded_by ? ' · ' + row.recorded_by : ''}</p>
        </article>)}</div>
    </section>;
  }

  return <section className="plp-panel" aria-label={heading}>
    <div className="plp-panel__head"><div><h3>{heading}</h3><p>Public enrollment uses email verification; existing invitations are still supported. Proposed rates stay at pending owner approval until Doc signs off. Commission posting is {data.commissionsActive ? 'active' : 'off'}.</p></div></div>
    {error && <p className="plp-form-error" role="alert">{error}</p>}
    {note && <p role="status">{note}</p>}
    <form className="plp-task-form" onSubmit={(event) => { event.preventDefault(); post({ action: 'invite', ...form }, (result) => 'Invitation ready: ' + result.invite.path); }}>
      <label>Name<input required maxLength={120} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></label>
      <label>Email<input required type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} /></label>
      <label>Tier<select value={form.tier} onChange={(e) => setForm((v) => ({ ...v, tier: e.target.value }))}>
        {Object.entries(PROPOSED_AFFILIATE_RATES).filter(([key]) => key !== 'manager_override').map(([key, value]) => (
          <option key={key} value={key}>{value.label} ({Math.round(value.rate * 100)}%, pending approval)</option>
        ))}
      </select></label>
      <button className="plp-primary" type="submit" disabled={busy}>Create invitation</button>
    </form>
    <div className="plp-task-list">{(data.partners || []).length === 0 ? <p className="plp-disclosure">No partners yet.</p>
      : data.partners.map((row) => <article className="plp-enquiry" key={row.id}>
        <header><h4>{row.name}</h4><time>{row.status}</time></header>
        <p>{row.referral_code} · {row.tier.replace('_', ' ')} · {Math.round(Number(row.rate) * 100)}% ({row.rate_approval_status.replaceAll('_', ' ')})</p>
      </article>)}</div>
  </section>;
}
