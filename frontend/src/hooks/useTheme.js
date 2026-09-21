import { useEffect, useState } from "react";

// Reads the theme index.html already applied, keeps it in sync, and remembers the choice.
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // storage can be blocked (private mode); the theme still works for this session
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return [theme, toggle];
}