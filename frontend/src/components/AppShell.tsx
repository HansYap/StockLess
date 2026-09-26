import { LanguageSwitcher } from "./LanguageSwitcher.tsx";
import { t, useLanguage } from "../i18n/index.ts";
import type { ReactNode } from "react";
import type { SourceMode } from "../engine.ts";
import { WorkspaceDecor } from "./WorkspaceDecor.tsx";
import { Logo } from "./Logo.tsx";

export type StepId = 1 | 2 | 3 | 4;

const STEPS: readonly { id: StepId; label: string }[] = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Map columns" },
  { id: 3, label: "Check readiness" },
  { id: 4, label: "Plan purchases" },
];

interface AppShellProps {
  readonly current: StepId;
  /** Highest step the session has legitimately reached. */
  readonly reached: StepId;
  readonly onNavigate: (step: StepId) => void;
  readonly sourceMode?: SourceMode;
  readonly sourceName?: string;
  readonly notice?: string | null;
  readonly onClear?: () => void;
  readonly children: ReactNode;
}

/** Frames every screen with the brand bar and the four-step progress indicator. */
export function AppShell({
  current,
  reached,
  onNavigate,
  sourceMode,
  sourceName,
  notice,
  onClear,
  children,
}: AppShellProps) {
  useLanguage();
  return (
    <div className="frame">
      <WorkspaceDecor />
      <header className="topbar">
        <button type="button" className="brand brand--button" onClick={() => onNavigate(1)} aria-label={t("StockLess — upload")}>
          <Logo />
        </button>
        {t(sourceMode && (
          <div className="session-status" aria-label={t("Active session")}>
            <span className={`pill ${sourceMode === "sample" ? "pill--amber" : "pill--teal"}`}>
              {t(sourceMode === "sample" ? "Sample data" : "Retailer file")}
            </span>
            {t(sourceName && <span className="session-status__name">{sourceName}</span>)}
            {t(onClear && (
              <button type="button" className="btn btn--small btn--ghost" onClick={onClear}>
                {t("Clear session")}</button>
            ))}
          </div>
        ))}
        <a className="workspace-home-link" href="#home"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/></svg>{t("Homepage")}</a>
        <LanguageSwitcher />
      </header>

      <nav className="stepper" aria-label={t("Progress")}>
        <ol className="stepper__inner">
          {t(STEPS.map((step) => {
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
                  <span className="step__plant" aria-hidden="true">{["🌱","🌿","🍃","🌳"][step.id - 1]}</span>
                  <span className="step__dot">{t(done ? "✓" : step.id)}</span>
                  <span className="step__label">{t(step.label)}</span>
                </button>
                <span className="step__line" aria-hidden="true" />
              </li>
            );
          }))}
        </ol>
      </nav>

      <div className="page">
        {t(notice && <p className="notice notice--info" role="status">{t(notice)}</p>)}
        {children}
      </div>
    </div>
  );
}
