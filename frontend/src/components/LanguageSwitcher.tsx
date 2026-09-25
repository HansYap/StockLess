import { t, useLanguage, setLanguage, type Language } from "../i18n/index.ts";
import "../i18n/language.css";

/** Native select keeps the compact language control keyboard and touch accessible. */
export function LanguageSwitcher() {
  const language = useLanguage();
  return <label className="language-switcher">
    <svg viewBox="0 0 36 32" width="28" height="26" aria-hidden="true">
      <path d="M3 2h18v23H9l-6 5Z" fill="#86c7a1" />
      <path d="M20 2h10a3 3 0 0 1 3 3v20H20Z" fill="#d6eddd" />
      <path d="m7 20 5-13 5 13m-8-4h6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 10h9m-5-3v3m-3 3c1 4 4 6 7 8m-1-11c-1 5-3 8-7 11" fill="none" stroke="#347452" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
    <select aria-label={t("Language")} value={language} onChange={event => setLanguage(event.target.value as Language)}>
      <option value="en" lang="en">English</option>
      <option value="zh" lang="zh-Hans">中文</option>
      <option value="ms" lang="ms">Bahasa Melayu</option>
    </select>
  </label>;
}
