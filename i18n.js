// GeoNEXA AI — Language switcher (English / Kinyarwanda)
// Add <script defer src="i18n.js"></script> to every page, after config.js.
//
// HOW TO USE ON ANY PAGE: add data-i18n="key" to any element whose text
// should translate, e.g.:
//   <a class="navlink" data-i18n="nav_dashboard">🏠 Dashboard</a>
// For placeholders on inputs, use data-i18n-placeholder instead:
//   <input data-i18n-placeholder="search_placeholder" placeholder="Search...">
//
// Add a language switcher anywhere with:
//   <select id="languageSwitcher"><option value="en">English</option><option value="rw">Kinyarwanda</option></select>
// This script wires it up automatically if it finds that element.

const GEONEXA_TRANSLATIONS = {
  en: {
    nav_dashboard: "🏠 Dashboard",
    nav_map: "🗺️ Map Explorer",
    nav_property_analysis: "📊 Property Analysis",
    nav_reports: "📄 Reports",
    nav_saved: "❤ Saved Properties",
    nav_alerts: "🔔 Alerts",
    nav_ai: "🤖 AI Assistant",
    nav_engineer: "🧭 Engineer Workspace",
    nav_admin: "🛡️ Admin Panel",
    nav_subscription: "💳 Subscription",
    nav_settings: "⚙️ Settings",
    btn_login: "Login to GeoNEXA →",
    btn_signup: "Create GeoNEXA Account →",
    btn_signout: "Sign out",
    btn_continue: "Continue →",
    btn_subscribe: "Subscribe →",
    btn_view_plans: "View Plans →",
    label_email: "Email Address",
    label_password: "Password",
    label_full_name: "Full Name",
    label_phone: "Phone Number",
    welcome_back: "Welcome back",
    welcome_sub: "Access intelligent land and property information.",
    create_account: "Create your account",
    forgot_password: "Forgot password?",
    remember_me: "Remember me",
    search_placeholder: "Search location, property ID, or place...",
    map_search_placeholder: "Search by UPI, owner, place, or district…",
    ai_ask_placeholder: "Ask about a parcel, zoning, or spatial risk…",
    loading: "Loading…",
    no_results: "No results found.",
  },
  rw: {
    nav_dashboard: "🏠 Ahabanza",
    nav_map: "🗺️ Ikarita",
    nav_property_analysis: "📊 Isesengura ry'Ubutaka",
    nav_reports: "📄 Raporo",
    nav_saved: "❤ Ibyabitswe",
    nav_alerts: "🔔 Imenyesha",
    nav_ai: "🤖 Umufasha wa AI",
    nav_engineer: "🧭 Ahakorera Ba Injeniyeri",
    nav_admin: "🛡️ Igenzura",
    nav_subscription: "💳 Kwiyandikisha",
    nav_settings: "⚙️ Igenamiterere",
    btn_login: "Injira muri GeoNEXA →",
    btn_signup: "Fungura Konti ya GeoNEXA →",
    btn_signout: "Sohoka",
    btn_continue: "Komeza →",
    btn_subscribe: "Iyandikishe →",
    btn_view_plans: "Reba Amafaranga →",
    label_email: "Imeri",
    label_password: "Ijambobanga",
    label_full_name: "Amazina Yombi",
    label_phone: "Numero ya Telefoni",
    welcome_back: "Murakaza neza",
    welcome_sub: "Bona amakuru y'ubutaka n'imitungo hifashishijwe ikoranabuhanga.",
    create_account: "Fungura konti yawe",
    forgot_password: "Wibagiwe ijambobanga?",
    remember_me: "Nyibuke",
    search_placeholder: "Shakisha aho, nomero y'umutungo, cyangwa ahantu...",
    map_search_placeholder: "Shakisha ukoresheje UPI, nyir'ubutaka, ahantu, cyangwa akarere…",
    ai_ask_placeholder: "Baza ku byerekeye umutungo, imikoreshereze y'ubutaka, cyangwa ibyago...",
    loading: "Birimo gutegurwa…",
    no_results: "Nta gisubizo cyabonetse.",
  },
};

(function () {
  function applyTranslations(lang) {
    const dict = GEONEXA_TRANSLATIONS[lang] || GEONEXA_TRANSLATIONS.en;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key]) el.setAttribute("placeholder", dict[key]);
    });

    document.documentElement.setAttribute("lang", lang);

    const switcher = document.getElementById("languageSwitcher");
    if (switcher) switcher.value = lang;
  }

  function setLanguage(lang) {
    try { localStorage.setItem("geonexa_lang", lang); } catch (_) {}
    applyTranslations(lang);
  }

  function init() {
    let lang = "en";
    try { lang = localStorage.getItem("geonexa_lang") || "en"; } catch (_) {}
    applyTranslations(lang);

    const switcher = document.getElementById("languageSwitcher");
    if (switcher) {
      switcher.value = lang;
      switcher.addEventListener("change", () => setLanguage(switcher.value));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose globally in case a page wants to trigger it from a button
  // instead of a <select> (e.g. a toggle button).
  window.geonexaSetLanguage = setLanguage;
})();
