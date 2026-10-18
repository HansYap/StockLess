import { t } from "../i18n/index.ts";
import { Logo } from "./Logo.tsx";
import { GrowthIcon, type GrowthStage } from "./GrowthIcon.tsx";

/** The plant grows one stage at a time and ends as the website earth. */
const OPENING_STAGES: readonly GrowthStage[] = ["sprout", "leaves", "potted", "tree"];
import "./opening.css";

/** Branded loading screen, shown while the site picks a route, the workspace loads or a saved dataset opens. */
export function OpeningScreen({ title = "Opening your workspace…" }: { title?: string }) {
  return (
    <main className="opening-screen" role="status" aria-live="polite">
      <Logo height={34} />
      <span className="opening-screen__plants" aria-hidden="true">
        {OPENING_STAGES.map((stage, index) => (
          <span key={stage} className={`opening-screen__plant opening-screen__plant--${index + 1}`}>
            <GrowthIcon stage={stage} size={48} />
          </span>
        ))}
        <span className="opening-screen__plant opening-screen__plant--5">
          <img src="/impact/sx-earth.svg" alt="" width={48} height={48} />
        </span>
      </span>
      <p className="opening-screen__title">{t(title)}</p>
      <span className="opening-screen__bar" aria-hidden="true"><span /></span>
      <p className="opening-screen__note">{t("Your data stays on this device.")}</p>
      {/* The whole growth path, with the stage that is showing now lit up. */}
      <span className="opening-screen__path" aria-hidden="true">
        {OPENING_STAGES.map((stage, index) => <span key={stage} className={`opening-screen__step opening-screen__step--${index + 1}`}><GrowthIcon stage={stage} size={18} /></span>)}
        <span className="opening-screen__step opening-screen__step--5"><img src="/impact/sx-earth.svg" alt="" width={18} height={18} /></span>
      </span>
    </main>
  );
}
