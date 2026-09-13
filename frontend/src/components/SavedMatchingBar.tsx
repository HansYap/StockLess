import type { MappingState } from "../engine.ts";

interface SavedMatchingBarProps {
  readonly mapping: MappingState;
  readonly onConfirmAll: () => void;
}

/** US7.1: offers a filled-in saved matching for confirmation in one action. */
export function SavedMatchingBar({ mapping, onConfirmAll }: SavedMatchingBarProps) {
  if (!Object.values(mapping.mappings).some((match) => match?.confirmed === false)) return null;

  return (
    <div className="notice notice--warn" role="status" style={{ alignItems: "center" }}>
      <b>We filled in the column matching you saved last time.</b>
      <span>Check each suggestion, then confirm them all at once.</span>
      <button type="button" className="btn btn--small btn--primary" onClick={onConfirmAll}>
        Confirm all
      </button>
    </div>
  );
}
