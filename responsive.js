// GeoNEXA AI — shared mobile menu behaviour.
// On pages with a .sidebar: adds a backdrop, closes the drawer when a link is
// tapped / backdrop tapped / Escape pressed, and injects a ☰ button on pages
// that don't already have their own.
(function () {
  function init() {
    var sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;

    var backdrop = document.createElement("div");
    backdrop.className = "gx-backdrop";
    document.body.appendChild(backdrop);

    var existing = document.querySelector(
      '[id*="amburger" i], [id="hamb"], [class~="hamb"], [class*="hamburger" i], [id*="menuBtn" i], [id*="menu-btn" i], [id*="menuToggle" i]'
    );

    var burger = null;
    if (!existing) {
      burger = document.createElement("button");
      burger.className = "gx-burger";
      burger.type = "button";
      burger.setAttribute("aria-label", "Open menu");
      burger.textContent = "☰";
      document.body.appendChild(burger);
      document.body.classList.add("gx-has-burger");
      burger.addEventListener("click", function () { sidebar.classList.toggle("open"); });
    }


    // ---- Floating navigation ----
    document.body.classList.add("gx-float");
    function setSide() { document.documentElement.style.setProperty("--gx-side", sidebar.offsetWidth + "px"); }
    setSide(); window.addEventListener("resize", setSide);

    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var wanted = [
      ["dashboard.html", "🏠", "Home"], ["map-explorer.html", "🗺️", "Map"],
      ["ai-assistant.html", "🤖", "AI"], ["alerts.html", "🔔", "Alerts"]
    ];
    var dock = document.createElement("div");
    dock.className = "gx-dock";
    dock.setAttribute("role", "navigation"); dock.setAttribute("aria-label", "Quick navigation");
    var anyOn = false;
    wanted.forEach(function (w) {
      var a = document.createElement("a");
      a.href = w[0];
      a.innerHTML = '<span class="ic">' + w[1] + "</span><span>" + w[2] + "</span>";
      if (here === w[0]) { a.className = "on"; anyOn = true; }
      dock.appendChild(a);
    });
    var menu = document.createElement("button");
    menu.type = "button";
    menu.setAttribute("aria-label", "Open full menu");
    menu.innerHTML = '<span class="ic">☰</span><span>Menu</span>';
    if (!anyOn) menu.className = "on";
    menu.addEventListener("click", function () { sidebar.classList.toggle("open"); });
    dock.appendChild(menu);
    document.body.appendChild(dock);

    function sync() {
      backdrop.classList.toggle("show", sidebar.classList.contains("open") && window.innerWidth <= 820);
    }
    new MutationObserver(sync).observe(sidebar, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 820) sidebar.classList.remove("open");
      sync();
    });

    backdrop.addEventListener("click", function () { sidebar.classList.remove("open"); });
    sidebar.addEventListener("click", function (e) {
      if (e.target.closest("a")) sidebar.classList.remove("open");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") sidebar.classList.remove("open");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
