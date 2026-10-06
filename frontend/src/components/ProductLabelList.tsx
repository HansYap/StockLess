import { t } from "../i18n/index.ts";
import type { ProductLabels } from "../engine.ts";

export function ProductLabelList({ labels, shown }: { labels?: ProductLabels; shown: readonly (string | undefined)[] }) {
  if (!labels) return null;
  const visible = new Set(shown);
  const other = [...new Set([...labels.names, ...labels.codes, ...labels.packs])].filter(label => !visible.has(label));
  return other.length ? <p className="product-labels"><span>{t("Other product labels")}: </span>{other.join(" · ")}</p> : null;
}
