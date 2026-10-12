import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import "./nice-select.css";

interface Choice { readonly value: string; readonly label: string; readonly disabled: boolean }
interface Place { readonly left: number; readonly top: number; readonly width: number; readonly maxHeight: number; readonly up: boolean }

/**
 * A native <select> with our own option list, so the open list looks the same
 * in every browser on Mac and Windows. The real <select> stays in the page:
 * it keeps the value, the label, keyboard use, form behaviour and tests.
 * Touch screens keep the phone's own picker.
 */
export function NiceSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { onMouseDown, className, ...rest } = props;
  const selectRef = useRef<HTMLSelectElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);

  const measure = () => {
    const box = selectRef.current?.getBoundingClientRect();
    if (!box) return;
    const below = window.innerHeight - box.bottom - 12, above = box.top - 12;
    const up = below < 220 && above > below;
    setPlace({ left: box.left, top: up ? box.top - 6 : box.bottom + 6, width: Math.max(box.width, 220), maxHeight: Math.min(360, up ? above : below), up });
  };

  const openList = (event: MouseEvent<HTMLSelectElement>) => {
    onMouseDown?.(event);
    const select = selectRef.current;
    if (event.defaultPrevented || !select || select.disabled || event.button !== 0) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) return;
    event.preventDefault();
    select.focus();
    const list = Array.from(select.options).map(option => ({ value: option.value, label: option.label || option.text, disabled: option.disabled }));
    setChoices(list);
    setActive(Math.max(0, select.selectedIndex));
    measure();
    setOpen(true);
  };

  const close = (refocus = true) => { setOpen(false); if (refocus) selectRef.current?.focus(); };

  const choose = (index: number) => {
    const select = selectRef.current, choice = choices[index];
    if (!select || !choice || choice.disabled) return;
    if (select.value !== choice.value) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, choice.value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    listRef.current?.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && target !== selectRef.current) close(false);
    };
    const reposition = () => measure();
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { document.removeEventListener("pointerdown", outside, true); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open]);

  const step = (from: number, by: number) => {
    for (let i = from + by; i >= 0 && i < choices.length; i += by) if (!choices[i].disabled) return i;
    return from;
  };
  const onKey = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(i => step(i, 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => step(i, -1)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(step(-1, 1)); }
    else if (event.key === "End") { event.preventDefault(); setActive(step(choices.length, -1)); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(active); }
    else if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); close(); }
  };

  useEffect(() => { if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  const current = selectRef.current?.value;
  return <>
    <select {...rest} ref={selectRef} className={["nice-select", className].filter(Boolean).join(" ")} onMouseDown={openList} aria-expanded={open || undefined} />
    {open && place && createPortal(
      <ul ref={listRef} role="listbox" tabIndex={-1} className={"nice-select__list" + (place.up ? " nice-select__list--up" : "")}
        aria-label={selectRef.current?.getAttribute("aria-label") ?? selectRef.current?.labels?.[0]?.textContent ?? undefined}
        aria-activedescendant={`nice-option-${active}`} onKeyDown={onKey}
        style={{ left: place.left, top: place.top, minWidth: place.width, maxHeight: place.maxHeight }}>
        {choices.map((choice, index) => {
          const selected = choice.value === current;
          const empty = choice.value === "";
          return <li key={index} id={`nice-option-${index}`} role="option" aria-selected={selected} aria-disabled={choice.disabled || undefined}
            className={"nice-select__option" + (index === active ? " is-active" : "") + (selected ? " is-selected" : "") + (empty ? " is-empty" : "")}
            onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
            <span className="nice-select__tick" aria-hidden="true">{selected ? "✓" : ""}</span>{choice.label}
          </li>;
        })}
      </ul>, document.body)}
  </>;
}
