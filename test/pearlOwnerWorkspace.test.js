import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialBook } from '../src/admin/pearl/chapterData.js';
import { chapterReview, daysOfMonth, emptyRow, localDate, readBook, saveRow, shiftMonth } from '../src/admin/pearl/workingFile.js';

const add = (book, table, value, chapter = 'boracay', id) => saveRow(book, chapter, table, { ...emptyRow(table), ...value }, id);
const active = title => ({ title, stage: 'Active', age: 'Declared 60+', consent: 'Recorded' });
const cleanBook = () => readBook(JSON.parse(JSON.stringify(initialBook())));

test('the three chapter files open without seeded offers, people, sessions, attendance or enquiries', () => {
  const book = cleanBook();
  assert.deepEqual(Object.keys(book.locations), ['boracay', 'singapore', 'malaysia']);
  for (const [chapter, location] of Object.entries(book.locations)) {
    for (const field of ['offers', 'members', 'events', 'attendance', 'enquiries']) assert.equal(location[field].length, 0, chapter + ':' + field);
    for (const row of chapterReview(location).filter(r => r.state === 'Ready')) assert.match(row.evidence, /^https:\/\/github\.com\/besfeng23\//);
    assert.ok(chapterReview(location).some(r => r.state === 'Needs decision'));
    assert.ok(chapterReview(location).some(r => r.state === 'Needs verification'));
  }
});

test('chapter-specific offers keep currency and empty prices distinct from zero, with evidence for Ready', () => {
  let book = add(cleanBook(), 'offers', { title: 'Review copy' }, 'singapore');
  assert.equal(book.locations.boracay.offers.length, 0);
  const offer = book.locations.singapore.offers[0];
  assert.equal(offer.amount, '');
  assert.throws(() => add(book,'offers',{ ...offer, state:'Ready' },'singapore',offer.id), /evidence/);
  assert.throws(() => add(book,'offers',{ ...offer, amount:'150' },'singapore',offer.id), /currency/);
  book = add(book,'offers',{ ...offer, amount:'0', currency:'sgd', detail:'Test benefit', basis:'One-off', state:'Ready', evidence:'Test decision' },'singapore',offer.id);
  assert.equal(book.locations.singapore.offers.length, 1);
  assert.equal(book.locations.singapore.offers[0].amount, '0');
  assert.equal(book.locations.singapore.offers[0].currency, 'SGD');
  assert.deepEqual(readBook(JSON.parse(JSON.stringify(book))),book);
  assert.throws(() => add(book,'members',{ title:'Sample', offer:offer.id }), /missing membership tier/);
});

test('only Boracay can hold member and attendance records, and activation checks declaration and consent', () => {
  const book = cleanBook();
  assert.throws(() => add(book,'members',active('Test reference'),'malaysia'), /Boracay/);
  assert.throws(() => add(book,'members',{ title:'Test', stage:'Active' }), /consent/);
  const next = add(book,'members',active('File reference'));
  assert.throws(() => add(next,'members',active('File reference')), /already exists/);
  const imported = structuredClone(next);
  imported.locations.singapore.members = imported.locations.boracay.members;
  assert.throws(() => readBook(imported), /Boracay/);
});

test('a participation update is unique per member and activity and cannot exceed known capacity', () => {
  let book = add(cleanBook(),'members',active('Reference A'));
  book = add(book,'members',active('Reference B'));
  book = add(book,'events',{ title:'Undated working session', capacity:'1' });
  const [a,b] = book.locations.boracay.members;
  const [event] = book.locations.boracay.events;
  const entry = { member:a.id, event:event.id, outcome:'Registered interest' };
  book = add(book,'attendance',entry);
  assert.throws(() => add(book,'attendance',{ ...entry, outcome:'Attended' }), /after the activity starts/);
  book = add(book,'events',{ ...event, date:'2020-01-02' },'boracay',event.id);
  book = add(book,'attendance',{ ...entry, outcome:'Attended' });
  assert.equal(book.locations.boracay.attendance.length,1);
  assert.throws(() => add(book,'attendance',{ ...entry, member:b.id, outcome:'Attended' }), /capacity/);
  book = add(book,'attendance',{ ...entry, outcome:'Did not attend' });
  book = add(book,'attendance',{ ...entry, member:b.id, outcome:'Attended' });
  assert.equal(book.locations.boracay.attendance.length,2);
  assert.throws(() => add(book,'events',{ ...event, date:'2099-01-01' },'boracay',event.id), /after the activity starts/);
  assert.deepEqual(readBook(JSON.parse(JSON.stringify(book))),book);
});

test('enquiries retain their reference, follow-up, status and separation from other chapters', () => {
  let book = add(cleanBook(),'enquiries',{ title:'Review M-1', topic:'Partner', owner:'Coordinator', due:'2026-12-01', action:'Verify scope' },'malaysia');
  const row = book.locations.malaysia.enquiries[0];
  book = add(book,'enquiries',{ ...row, stage:'In progress' },'malaysia',row.id);
  assert.equal(book.locations.malaysia.enquiries[0].action,'Verify scope');
  assert.equal(book.locations.malaysia.enquiries[0].stage,'In progress');
  assert.equal(book.locations.singapore.enquiries.length,0);
  assert.throws(() => readBook({ ...book,version:20 }), /working file/);
  const faulty = structuredClone(book);
  delete faulty.locations.singapore.checks;
  assert.throws(() => readBook(faulty), /register is missing/);
});

test('calendar navigation obeys local dates and evidence gates on activities', () => {
  assert.equal(localDate('Asia/Manila', new Date('2026-11-21T19:00:00Z')), '2026-11-22');
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
  assert.equal(daysOfMonth('2024-02').at(-1),'2024-02-29');
  assert.deepEqual(daysOfMonth('2026-11').slice(0,7),['','','','','','','2026-11-01']);
  assert.throws(() => add(cleanBook(),'events',{ title:'Plan',date:'2026-02-31' }), /valid date/);
  assert.throws(() => add(cleanBook(),'events',{ title:'Plan',state:'Ready',evidence:'Example reference' }), /ready activity/);
});

test('the working file is isolated from live services and keeps the existing protected club entry point', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const shell = read('src/admin/PlpAdminApp.jsx');
  assert.match(shell, /case 'workbook': return <OwnerWorkspace file=\{pearlFile\} \/>/);
  assert.match(shell, /case 'register': return <ClubAdminView code=\{code\}/);
  for (const file of ['useWorkingFile.js','OwnerWorkspace.jsx','WorkbookUI.jsx','Registers.jsx','workingFile.js']) {
    assert.doesNotMatch(read('src/admin/pearl/' + file), /fetch\s*\(|localStorage|sessionStorage|\/api\/|XMLHttpRequest/);
  }
  assert.equal(JSON.parse(read('vercel.json')).git.deploymentEnabled['draft/pearl-club-owner-workspace'], false);
});
