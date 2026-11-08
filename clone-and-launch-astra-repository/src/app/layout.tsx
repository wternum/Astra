import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./refinement.css";

export const metadata: Metadata = {
  applicationName: "ASTRA",
  title: "ASTRA · Prompt Optimization Studio",
  description: "ASTRA：把想法打磨成更清晰的提示词。支持实时诊断、AI 优化、模型接入与版本迭代。",
};

const appearanceScript = `(function(){try{var saved=localStorage.getItem("promptforge:theme");var dark=saved==="dark"||saved==="midnight";document.documentElement.dataset.theme=dark?"dark":"light";document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";document.documentElement.style.colorScheme="light";}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: appearanceScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
