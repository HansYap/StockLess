import { useLanguage } from "../i18n/index.ts";
import { Stocky, type StockyPose } from "../onboarding/Stocky.tsx";
import "./hero-stocky.css";

/** A small Stocky with an optional speech bubble for the page title bands. Decorative only. */
export function HeroStocky({ pose, say, variant = "flex" }: {
  readonly pose: StockyPose;
  readonly say?: { readonly en: string; readonly zh: string; readonly ms: string };
  readonly variant?: "flex" | "corner" | "float";
}) {
  const language = useLanguage();
  const text = say ? (language === "zh" ? say.zh : language === "ms" ? say.ms : say.en) : undefined;
  return <div className={`hero-stocky hero-stocky--${variant}`} aria-hidden="true">
    {text && <span className="hero-stocky__bubble">{text}</span>}
    <Stocky pose={pose} size={60} />
  </div>;
}
