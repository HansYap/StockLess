import { t } from "../i18n/index.ts";
import { Logo } from "./Logo.tsx";
import { GrowthIcon, STEP_GROWTH } from "./GrowthIcon.tsx";
import "./opening.css";

/** Branded loading screen, shown while the site picks a route, the workspace loads or a saved dataset opens. */
export function OpeningScreen({ title = "Opening your workspace…" }: { title?: string }) {
  return (
    <main className="opening-screen" role="status" aria-live="polite">
      <Logo height={34} />
      <span className="opening-screen__plants" aria-hidden="true">
        {STEP_GROWTH.map((stage, index) => (
          <span key={stage} className={`opening-screen__plant opening-screen__plant--${index + 1}`}>
            <GrowthIcon stage={stage} size={48} />
          </span>
        ))}
      </span>
      <p className="opening-screen__title">{t(title)}</p>
      <span className="opening-screen__bar" aria-hidden="true"><span /></span>
      <p className="opening-screen__note">{t("Your data stays on this device.")}</p>
    </main>
  );
}
