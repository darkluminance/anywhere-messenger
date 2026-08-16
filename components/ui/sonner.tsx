"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

// This app toggles a `.dark` class on <html> manually (see components/header.tsx)
// instead of using next-themes, so we mirror that class onto Sonner's theme
// prop and keep it in sync while the user flips the theme at runtime.
export function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setTheme(root.classList.contains("dark") ? "dark" : "light");

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      {...props}
    />
  );
}
