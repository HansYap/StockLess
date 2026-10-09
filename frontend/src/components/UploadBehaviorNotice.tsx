import { t } from "../i18n/index.ts";
import "./upload-behavior.css";

export function UploadBehaviorNotice({ replacing = false, compact = false }: {
  readonly replacing?: boolean;
  readonly compact?: boolean;
}) {
  return <section className="upload-behavior" aria-label={t("How uploads affect your plan")}>
    <span className="upload-behavior__icon" aria-hidden="true">!</span>
    <div>
      <strong>{t("One plan, one sales file")}</strong>
      <p>{t(replacing
        ? "This file will replace the sales data used by your current purchase plan and impact results. Previous uploads are not combined."
        : "Your plan uses one sales file at a time. Later uploads replace its sales data instead of adding to it.")}</p>
      {!compact && <p>{t("Include the full sales period you want to analyse in one file. For example, to analyse September and October together, include both months in the same file.")}</p>}
      {replacing && <p className="upload-behavior__history">{t("Your saved plan stays available until the new plan is ready. The previous file and plan remain separately in Upload history; your latest 12 uploads are kept.")}</p>}
    </div>
  </section>;
}
