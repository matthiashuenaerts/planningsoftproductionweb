import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import marketing from "@/locales/marketing";

const supportedLangs = ["nl", "en", "fr"] as const;
type Lang = (typeof supportedLangs)[number];

export function useMarketingLang() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramLang = searchParams.get("lang") as Lang | null;

  const lang: Lang =
    paramLang && supportedLangs.includes(paramLang) ? paramLang : "nl";

  const t = (key: string) => marketing[lang]?.[key] ?? key;

  const changeLang = (newLang: Lang) => {
    const params = new URLSearchParams(searchParams);
    params.set("lang", newLang);
    setSearchParams(params, { replace: true });
  };

  return { lang, t, changeLang, supportedLangs };
}
