import { useId, useState } from 'react';
/** Focus and tap both reveal the same explanation; Escape dismisses it. */
export function FieldHelp({ description }: { description: string }) {
 const id = useId();
 const [open, setOpen] = useState(false);
 return <span className={`hint${open ? ' hint--open' : ''}`}>
  <button type="button" className="hint__btn" aria-label={description} aria-describedby={id} aria-expanded={open}
   onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)} onKeyDown={event => { if(event.key === 'Escape') {setOpen(false);event.currentTarget.blur();} }}>?</button>
  <span id={id} className="hint__bubble" role="tooltip">{description}</span>
 </span>;
}
