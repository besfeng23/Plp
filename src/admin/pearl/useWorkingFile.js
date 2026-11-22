import { useEffect, useState } from 'react';
import { initialBook } from './chapterData.js';
import { localDate, readBook, saveRow } from './workingFile.js';

export default function useWorkingFile() {
  const [book, setBook] = useState(initialBook);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function reset() { setBook(initialBook()); setDirty(false); }
  function update(chapter, collection, values, id) {
    setBook(saveRow(book, chapter, collection, values, id));
    setDirty(true);
  }
  function replace(raw) {
    const next = readBook(raw);
    if (dirty && !window.confirm('Replace the unsaved entries in this tab with the selected working file?')) return false;
    setBook(next); setDirty(false); return true;
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(book)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'PLP-Pearl-Club-' + localDate('Asia/Manila') + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setDirty(false);
  }
  return { book, dirty, update, replace, download, reset };
}
