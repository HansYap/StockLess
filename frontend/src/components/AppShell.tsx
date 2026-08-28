import type { ReactNode } from "react";
import { Logo } from "./Logo.tsx";

export type StepId = 1 | 2 | 3 | 4;

const STEPS: readonly { id: StepId; label: string }[] = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Map columns" },
  { id: 3, label: "Check readiness" },
  { id: 4, label: "Review demand" },
];

interface AppShellProps {
  readonly current: StepId;
  /** Highest step the session has legitimately reached. */
  readonly reached: StepId;
  readonly onNavigate: (step: StepId) => void;
  readonly children: ReactNode;
}

/** Frames every screen with the brand bar and the four-step progress indicator. */
export function AppShell({ current, reached, onNavigate, children }: AppShellProps) {
  return (
    <div className="frame">
      <header className="topbar">
        <a className="brand" href="#" aria-label="StockLess — home">
          <Logo />
        </a>
      </header>

      <nav className="stepper" aria-label="Progress">
        <ol className="stepper__inner">
          {STEPS.map((step) => {
            const done = step.id < current;
            const isCurrent = step.id === current;
            const reachable = step.id <= reached;
            return (
              <li
                key={step.id}
                className={`step${done ? " step--done" : ""}${isCurrent ? " step--current" : ""}`}
              >
                <button
                  type="button"
                  className="step__button"
                  disabled={!reachable || isCurrent}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => onNavigate(step.id)}
                >
                  <span className="step__dot">{done ? "✓" : step.id}</span>
                  <span className="step__label">{step.label}</span>
                </button>
                <span className="step__line" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="page">{children}</div>
    </div>
  );
}
