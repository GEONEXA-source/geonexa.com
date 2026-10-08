// GeoNEXA AI — Global accent color
// Add <script defer src="apply-theme.js"></script> to every page, right
// after config.js. Reads the same profiles.preferences.appearance.accent
// value the Settings > Appearance tab already saves, and applies it
// instantly — including from a cached copy so there's no color "flash"
// on page load while the network request is still in flight.

(function () {
  const ACCENT_HEX = { teal: "#14b8a6", blue: "#3b82f6", purple: "#a855f7", green: "#22c55e" };

  function applyAccent(accent) {
    const hex = ACCENT_HEX[accent] || ACCENT_HEX.teal;
    // Covers every page's accent variable name used across the app so
    // far (--teal on older pages, --accent on newer redesigned ones).
    document.documentElement.style.setProperty("--teal", hex);
    document.documentElement.style.setProperty("--accent", hex);
  }

  // 1. Apply instantly from cache (no flash), then refresh from the
  //    database in case it changed on another device.
  try {
    const cached = localStorage.getItem("geonexa_accent");
    if (cached) applyAccent(cached);
  } catch (_) {}

  async function syncFromServer() {
    try {
      if (!window.supabaseClient) return;
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return;

      const { data, error } = await supabaseClient
        .from("profiles")
        .select("preferences")
        .eq("id", session.user.id)
        .single();
      if (error) return;

      const accent = data?.preferences?.appearance?.accent || "teal";
      applyAccent(accent);
      try { localStorage.setItem("geonexa_accent", accent); } catch (_) {}
    } catch (_) {
      // Fail silently — cached color (or default teal) already applied.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncFromServer);
  } else {
    syncFromServer();
  }
})();
