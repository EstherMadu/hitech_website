(function () {
  const storedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = storedTheme || "auto";
  const resolvedTheme = theme === "auto" ? (prefersDark ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-bs-theme", resolvedTheme);
  document.documentElement.dataset.themePreference = theme;
}());
