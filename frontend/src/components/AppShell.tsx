import { LanguageSwitcher } from "./LanguageSwitcher.tsx";
import { t, useLanguage } from "../i18n/index.ts";
import type { ReactNode } from "react";
import type { SourceMode } from "../engine.ts";
import { WorkspaceDecor } from "./WorkspaceDecor.tsx";
import { Logo } from "./Logo.tsx";
import { SavedWorkspaceSidebar, type SavedWorkspaceSidebarProps } from "./SavedWorkspaceSidebar.tsx";
import "./workflow-shell.css";
import "./i3-typography.css";
import { GuideButton } from "../onboarding/Onboarding.tsx";

export type StepId = 1 | 2 | 3 | 4;

const STEPS: readonly { id: StepId; label: string }[] = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Map columns" },
  { id: 3, label: "Check readiness" },
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
  readonly workflowStyle?: boolean;
  readonly workspaceSidebar?: SavedWorkspaceSidebarProps;
  readonly i3Typography?: boolean;
  readonly onGuide?: () => Promise<void>;
  readonly onReturnToPlan?: () => void;
}

/** Shares the header and preparation progress, with navigation for saved uploads. */
export function AppShell({
  current,
  reached,
  onNavigate,
  sourceMode,
  sourceName,
  notice,
  onClear,
  children,
  workflowStyle,
  workspaceSidebar,
  i3Typography,
  onGuide,
  onReturnToPlan,
}: AppShellProps) {
  useLanguage();
  const workflow = workflowStyle ?? current <= 3;
  const impactShell = current === 4 && !workflow;
  const content = <>
      {current <= 3 && <nav className="stepper" aria-label={t("Progress")}>
        <ol className="stepper__inner">
          {STEPS.map((step) => {
            const done = step.id < current;
            const isCurrent = step.id === current;
            return <li key={step.id} className={`step${done ? " step--done" : ""}${isCurrent ? " step--current" : ""}`}>
              <button type="button" className="step__button" disabled={step.id > reached || isCurrent}
                aria-current={isCurrent ? "step" : undefined} onClick={() => onNavigate(step.id)}>
                <span className="step__plant" aria-hidden="true">{["🌱", "🌿", "🪴"][step.id - 1]}</span>
                <span className="step__dot">{done ? "✓" : step.id}</span><span className="step__label">{t(step.label)}</span>
              </button><span className="step__line" aria-hidden="true" />
            </li>;
          })}
        </ol>
      </nav>}
      <div className="page">
        {notice && <p className="notice notice--info" role="status">{t(notice)}</p>}
        {children}
      </div>
    </>;
  return (
    <div className={`frame${i3Typography ? " frame--i3" : ""}${workflow ? " frame--workflow" : ""}${impactShell ? " frame--impact" : ""}${workspaceSidebar ? " frame--saved-workspace" : ""}`}>
      {!workspaceSidebar && <WorkspaceDecor />}
      <header className="topbar">
        {workflow || impactShell ? (
          <a className="brand" href="#home" aria-label="StockLess"><Logo height={36} /></a>
        ) : (
          <button type="button" className="brand brand--button" onClick={() => onNavigate(1)} aria-label={t("StockLess — upload")}>
            <Logo />
          </button>
        )}
        {t(sourceMode && !workspaceSidebar && !impactShell && !(workflow && current > 1) && (
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
        <a className="workspace-home-link" href="#home" aria-label={t("Homepage")}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/></svg><span>{t("Homepage")}</span></a>
        <GuideButton onStart={onGuide} />
        {onReturnToPlan && <button type="button" className="onboarding-guide-button" onClick={onReturnToPlan}>{t("Back to my plan")}</button>}
        <LanguageSwitcher compact={workflow || Boolean(workspaceSidebar)} />
      </header>

      {workspaceSidebar ? <div className="saved-workspace">
        <SavedWorkspaceSidebar {...workspaceSidebar} />
        <div className="saved-workspace__content"><WorkspaceDecor />{content}</div>
      </div> : content}
    </div>
  );
}
