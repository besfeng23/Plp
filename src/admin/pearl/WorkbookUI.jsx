import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, CircleHelp, ClipboardCheck, FileQuestion, Pencil, Plus, X } from 'lucide-react';
import { definitions, emptyRow, localLabel } from './workingFile.js';

export const statusIcons = { Ready: ClipboardCheck, 'Needs decision': CircleHelp, 'Needs verification': FileQuestion };
export function Tag({ state }) {
  return <span className={'pw-tag pw-' + state.toLowerCase().replaceAll(' ', '-')}>{state}</span>;
}
export function Evidence({ value }) {
  if (!value) return null;
  let url;
  try { const candidate = new URL(value); if (candidate.protocol === 'https:') url = candidate; } catch { /* A written reference is also valid. */ }
  return url ? <a className="pw-source" href={url.href} target="_blank" rel="noreferrer">View source <ArrowUpRight size={13} /></a> : <span className="pw-source-note">Evidence · {value}</span>;
}
export function SectionHead({ title, note, action, onAction }) {
  return <div className="pw-section-head"><div><h2>{title}</h2>{note && <p>{note}</p>}</div>
    {action && <button className="pw-button pw-outline" onClick={onAction}><Plus size={16}/>{action}</button>}</div>;
}
export function Empty({ children }) { return <p className="pw-empty">{children}</p>; }

function sharedField(field, values, location, onChange) {
  const { key, label, type, options } = field;
  const value = values[key] || '';
  const props = { id: 'pw-field-' + key, name: key, value, onChange: e => onChange(key, e.target.value), maxLength: 2000 };
  if (type === 'select') return <select {...props}>{options.map(v => <option key={v} value={v}>{v || 'Unspecified'}</option>)}</select>;
  if (['offers', 'events', 'members'].includes(type)) {
    const choices = type === 'offers' ? location.offers.filter(o => o.kind === 'Membership tier') : location[type];
    return <select {...props} required={type !== 'offers'}><option value="">{type === 'offers' ? 'Unassigned' : 'Choose ' + label.toLowerCase()}</option>
      {choices.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>;
  }
  if (type === 'area' || type === 'evidence') return <textarea {...props} rows={2} required={type === 'evidence' && values.state === 'Ready'} placeholder={type === 'evidence' ? 'Source link, document or dated approval' : undefined}/>;
  if (type === 'date' || type === 'time') {
    return <input id={props.id} name={key} type={type} defaultValue={value} onInput={props.onChange} />;
  }
  return <input {...props} type="text" required={type === 'required'} inputMode={type === 'amount' ? 'decimal' : type === 'capacity' ? 'numeric' : undefined}
    placeholder={type === 'currency' ? 'Three-letter code' : undefined} />;
}

export function EditDialog({ editor, chapter, location, onClose, onSave }) {
  const ref = useRef(null);
  const { collection, row, presets } = editor;
  const def = definitions[collection];
  const [values, setValues] = useState(() => ({ ...emptyRow(collection, presets), ...row }));
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const update = (key, value) => { setChanged(true); setError(''); setValues(current => ({ ...current, [key]: value })); };
  const close = () => changed ? setDiscard(true) : onClose();
  const fields = def.fields.filter(({ key }) => {
    if (collection !== 'checks') return true;
    if (['asset', 'rights', 'alt'].includes(key)) return values.group === 'Content & imagery';
    if (['organisation', 'kind'].includes(key)) return values.group === 'Partners & suppliers';
    return true;
  });
  function submit(e) {
    e.preventDefault();
    const entered = Object.fromEntries(new FormData(e.currentTarget));
    try { onSave({ ...values, ...entered }); } catch (err) { setError(err.message); }
  }
  return <dialog className="pw-dialog" ref={ref} onCancel={e => { e.preventDefault(); close(); }} aria-labelledby="pw-dialog-title">
    <div className="pw-dialog-head"><div><span className="pw-eyebrow">{chapter.name} · Working file</span>
      <h2 id="pw-dialog-title">{row ? 'Edit ' : 'Add '}{def.noun}</h2></div><button className="pw-icon-button" aria-label="Close editor" onClick={close}><X size={19}/></button></div>
    {discard ? <div className="pw-discard"><p>Discard the changes in this form?</p><div className="pw-actions"><button className="pw-button" onClick={() => setDiscard(false)}>Keep editing</button><button className="pw-button pw-outline" onClick={onClose}>Discard changes</button></div></div> :
      <form onSubmit={submit}>
        <div className="pw-form">
          {['members', 'enquiries', 'attendance'].includes(collection) &&
            <p className="pw-form-hint">Use a reference or alias. Keep personal contact details and medical information in the protected record system.</p>}
          {collection === 'offers' && <p className="pw-form-hint">Leave unconfirmed amounts and terms blank. Each offer belongs to this chapter.</p>}
          {collection === 'events' && <p className="pw-form-hint">Leave the date blank until known. Dates and times use {chapter.timeZone}. Working-file entries never publish a session.</p>}
          {fields.map(f => <div key={f.key} className={'pw-field' + (['area','evidence','required'].includes(f.type) ? ' pw-field-wide' : '')}>
            <label htmlFor={'pw-field-' + f.key}>{f.label}{f.type === 'required' ? ' *' : ''}</label>{sharedField(f, values, location, update)}</div>)}
        </div>
        {error && <p className="pw-error" role="alert">{error}</p>}
        <div className="pw-dialog-actions"><button type="button" className="pw-button pw-outline" onClick={close}>Cancel</button><button className="pw-button" type="submit"><Check size={16}/>Save entry</button></div>
      </form>}
  </dialog>;
}

export function CheckRows({ rows, edit, compact = false }) {
  if (!rows.length) return <Empty>No items match this view.</Empty>;
  return <div className="pw-rows">{rows.map(row => <article key={(row.collection || 'checks') + row.id} className="pw-check-row">
    <div className="pw-row-main">{compact && <small className="pw-meta">{row.section}</small>}<h3>{row.title}</h3>
      {row.detail && <p>{row.detail}</p>}
      {!compact && <><div className="pw-row-details">{row.asset && <span>Asset · {row.asset}</span>}{row.rights && <span>Rights · {row.rights}</span>}{row.alt && <span>Alt text · {row.alt}</span>}{row.organisation && <span>Organisation · {row.organisation}</span>}{row.kind && <span>Role · {row.kind}</span>}{row.owner && <span>Owner · {row.owner}</span>}{row.due && <span>Review · {localLabel(row.due)}</span>}</div></>}
      <Evidence value={row.evidence}/></div><div className="pw-row-end"><Tag state={row.state}/><button className="pw-icon-button" aria-label={'Edit ' + row.title} onClick={() => edit(row.collection || 'checks', row)}><Pencil size={15}/></button></div>
    </article>)}</div>;
}
export function Jump({ label, detail, Icon, onClick }) {
  return <button className="pw-jump" onClick={onClick}><span className="pw-jump-icon"><Icon size={19} strokeWidth={1.5}/></span><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight size={16}/></button>;
}
