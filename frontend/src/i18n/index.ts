import { useSyncExternalStore } from "react";
import { messages } from "./messages.ts";

export type Language = "en" | "zh" | "ms";
const storageKey = "stockless.language";
function initialLanguage(): Language {
  try {
    const url = new URL(window.location.href);
    const incoming = url.searchParams.get("stockless-lang");
    if (incoming === "en" || incoming === "zh" || incoming === "ms") {
      url.searchParams.delete("stockless-lang");
      window.history.replaceState(null, "", url);
      try { localStorage.setItem(storageKey, incoming); } catch { /* Storage can be disabled. */ }
      return incoming;
    }
    const saved = localStorage.getItem(storageKey);
    return saved === "zh" || saved === "ms" ? saved : "en";
  } catch { return "en"; }
}
let language = initialLanguage();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setLanguage(next: Language) {
  language = next;
  try { localStorage.setItem(storageKey, next); } catch { /* Preference still lasts for this visit. */ }
  if (typeof document !== "undefined") document.documentElement.lang = next === "zh" ? "zh-Hans" : next;
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore(subscribe, () => language, () => "en" as Language);
}
export function getLocale() { return language === "zh" ? "zh-CN" : language === "ms" ? "ms-MY" : "en-GB"; }

/** Translate interface copy at render time; non-string React children pass through unchanged. */
export function t<T>(value: T): T {
  if (typeof value !== "string" || language === "en") return value;
  const key = value.replace(/\s+/g, " ").trim();
  const entry = Object.hasOwn(messages, key) ? messages[key] : undefined;
  if (entry) return (value.match(/^\s*/)?.[0] + entry[language === "zh" ? 0 : 1] + value.match(/\s*$/)?.[0]) as T;
  for (const template of templates) {
    const match = template.pattern.exec(key);
    if (match) return template.values[language === "zh" ? 0 : 1].replace(/\{(\d+)\}/g, (_, i) => String(template.translateValues ? t(match[Number(i) + 1]) : match[Number(i) + 1])) as T;
  }
  return value;
}
const templates = Object.entries(messages).filter(([key]) => /\{\d+\}/.test(key)).sort(([a], [b]) => b.length - a.length).map(([key, values]) => ({
  translateValues: /must be mapped|is mapped but|is visible but|available with Limited|available but one|positive value for|Source column for/.test(key),
  pattern: new RegExp("^" + key.split(/(\{\d+\})/).map(part => /^\{\d+\}$/.test(part) ? "(.*?)" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("") + "$"),
  values,
}));
if (typeof document !== "undefined") document.documentElement.lang = language === "zh" ? "zh-Hans" : language;

/** Carry the standalone HTML's choice into the separately served workspace. */
export function localizedWorkspaceHref(href: string): string {
  if (!/^https?:\/\//.test(href)) return href;
  const url = new URL(href);
  url.searchParams.set("stockless-lang", language);
  return url.toString();
}
