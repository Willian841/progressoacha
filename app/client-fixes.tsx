"use client";

import { useEffect } from "react";

function normalizeWhatsAppHref(href:string) {
  try {
    const url = new URL(href, window.location.origin);
    if (!/wa\.me$/i.test(url.hostname)) return href;
    let digits = url.pathname.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (!digits.startsWith("55")) digits = "55" + digits;
    if (digits.length > 13) digits = digits.slice(0, 13);
    if (!/^55\d{10,11}$/.test(digits)) return href;
    return "https://api.whatsapp.com/send?phone=" + digits + (url.search || "");
  } catch { return href; }
}

export default function ClientFixes() {
  useEffect(() => {
    const fixWhatsApp = () => {
      document.querySelectorAll<HTMLAnchorElement>('a[aria-label^="Abrir WhatsApp"]').forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (!href) return;
        anchor.setAttribute("href", normalizeWhatsAppHref(href));
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      });
    };
    let oldCityOptions:string[] = [];
    let resetUntil = 0;
    const resetCityOptions = () => {
      const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"));
      const citySelect = selects[2];
      if (!citySelect) return;
      oldCityOptions = Array.from(citySelect.options).slice(1).map(o => o.value).filter(Boolean);
      resetUntil = Date.now() + 12000;
      Array.from(citySelect.options).slice(1).forEach(o => o.remove());
      citySelect.selectedIndex = 0;
    };
    const observer = new MutationObserver(() => {
      fixWhatsApp();
      if (Date.now() < resetUntil) {
        const citySelect = Array.from(document.querySelectorAll<HTMLSelectElement>("select"))[2];
        if (citySelect && oldCityOptions.length) {
          Array.from(citySelect.options).slice(1).forEach(o => {
            if (oldCityOptions.includes(o.value)) o.remove();
          });
        }
      }
    });
    const onChange = (event:Event) => {
      const target = event.target as HTMLSelectElement;
      if (Array.from(document.querySelectorAll<HTMLSelectElement>("select"))[1] === target) resetCityOptions();
    };
    document.addEventListener("change", onChange, true);
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:["href"] });
    fixWhatsApp();
    return () => { document.removeEventListener("change", onChange, true); observer.disconnect(); };
  }, []);
  return null;
}
