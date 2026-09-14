import { CORE_COLUMN_PATHS, type MappingState } from "../engine.ts";
import { confirmAll } from "../storage/saved-matching.ts";

interface SavedMatchingBarProps {
  readonly mapping: MappingState;
  readonly onConfirmAll: () => void;
}

/** US7.1: offers a filled-in saved matching for confirmation in one action. */
export function SavedMatchingBar({ mapping, onConfirmAll }: SavedMatchingBarProps) {
  if (!Object.values(mapping.mappings).some((match) => match?.confirmed === false)) return null;

  const confirmed = confirmAll(mapping);
  const path = confirmed.identityConfirmed && !mapping.identityConfirmed
    ? CORE_COLUMN_PATHS.find((candidate) => candidate.id === confirmed.identityMode)
    : undefined;

  return (
    <div className="notice notice--warn" role="status" style={{ alignItems: "center" }}>
      <b>We filled in the column matching you saved last time.</b>
      <span>
        Check each suggestion, then confirm them all at once
        {path ? `, including how products are kept separate: “${path.label}”.` : "."}
      </span>
      <button type="button" className="btn btn--small btn--primary" onClick={onConfirmAll}>
        Confirm all
      </button>
    </div>
  );
}
