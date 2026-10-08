// GeoNEXA AI — Site-wide Loading Overlay (v5: real-work driven, shows once)
// Drop this one file into any page: <script src="loader.js"></script>
//
// Behavior — simple on purpose:
//  - The loader ONLY shows when your own code calls showLoader("...") or
//    wraps real work with withLoader("...", fn). It never shows itself
//    automatically on page load, and it never intercepts link clicks.
//  - It stays up for exactly as long as the real work takes — no fixed
//    2s/3s minimum, no artificial delay. If the page/data is already
//    ready (e.g. loaded from cache), don't call showLoader at all and
//    nothing appears.
//  - hideLoader() hides it immediately. Calling showLoader() again while
//    it's already open just updates the message — it does not stack or
//    restart a second loader, so it only ever happens once per action.
//
// Usage:
//   showLoader("Loading your dashboard…");
//   ... do the real async work ...
//   hideLoader();
//
//   // or, equivalently:
//   await withLoader("Loading your dashboard…", () => fetchStuff());
//
// Nothing else to set up — this injects its own CSS and HTML automatically.

(function () {
  const STYLE = `
    #geonexaLoaderOverlay {
      position: fixed; inset: 0; z-index: 99999;
      background: radial-gradient(900px 500px at 50% 35%, rgba(20,184,166,.08), transparent 60%), rgba(6, 10, 15, 0.94);
      backdrop-filter: blur(3px);
      display: none;
      align-items: center; justify-content: center;
      flex-direction: column; gap: 22px;
      opacity: 0;
      transition: opacity .25s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #geonexaLoaderOverlay.open { display: flex; }
    #geonexaLoaderOverlay.visible { opacity: 1; }

    .geonexa-orbit-stage {
      position: relative;
      width: 96px; height: 96px;
      display: flex; align-items: center; justify-content: center;
    }
    .geonexa-orbit-ring {
      position: absolute; inset: 0;
      border: 1px dashed rgba(20,184,166,.32);
      border-radius: 50%;
    }
    .geonexa-orbit-ring.r2 {
      inset: 14px;
      border-color: rgba(20,184,166,.18);
    }
    .geonexa-globe {
      width: 46px; height: 46px; border-radius: 50%;
      background: radial-gradient(circle at 34% 30%, #2ee8c4, #0f9488 55%, #065f56 100%);
      box-shadow: 0 0 22px rgba(20,184,166,.55), inset -6px -6px 10px rgba(0,0,0,.35);
      position: relative;
      overflow: hidden;
      animation: geonexaPulse 2.4s ease-in-out infinite;
    }
    .geonexa-globe::before {
      content: "";
      position: absolute; inset: 0;
      background:
        radial-gradient(10px 6px at 30% 65%, rgba(6,20,18,.55), transparent 70%),
        radial-gradient(14px 8px at 68% 35%, rgba(6,20,18,.45), transparent 70%),
        radial-gradient(8px 10px at 75% 70%, rgba(6,20,18,.4), transparent 70%);
    }
    .geonexa-orbit-spin {
      position: absolute; inset: 0;
      animation: geonexaOrbitSpin 2.6s linear infinite;
    }
    .geonexa-satellite {
      position: absolute;
      top: -3px; left: 50%;
      width: 18px; height: 18px;
      margin-left: -9px;
      animation: geonexaKeepUpright 2.6s linear infinite;
      filter: drop-shadow(0 0 5px rgba(20,184,166,.8));
    }
    .geonexa-satellite svg { width: 100%; height: 100%; display: block; }

    @keyframes geonexaOrbitSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes geonexaKeepUpright { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
    @keyframes geonexaPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }

    #geonexaLoaderTextWrap { text-align: center; max-width: 280px; }
    #geonexaLoaderBrand {
      color: #4fe8ce; font-size: 11px; font-weight: 800; letter-spacing: .14em;
      text-transform: uppercase; margin-bottom: 6px;
    }
    #geonexaLoaderText {
      color: #e8edf2; font-size: 13.5px; line-height: 1.5;
    }
    .geonexa-progress {
      width: 160px; height: 3px; border-radius: 3px;
      background: rgba(255,255,255,.08); overflow: hidden; margin-top: 4px;
    }
    .geonexa-progress::after {
      content: ""; display: block; height: 100%; width: 40%;
      background: linear-gradient(90deg, transparent, #14b8a6, transparent);
      animation: geonexaSweep 1.3s ease-in-out infinite;
    }
    @keyframes geonexaSweep {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(260%); }
    }
  `;

  const SATELLITE_SVG = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="9.5" width="5" height="5" rx="0.6" transform="rotate(-45 4.5 12)" fill="#9fe9da"/>
      <rect x="17" y="9.5" width="5" height="5" rx="0.6" transform="rotate(-45 19.5 12)" fill="#9fe9da"/>
      <rect x="8.5" y="8.5" width="7" height="7" rx="1.1" transform="rotate(45 12 12)" fill="#e8fffa"/>
      <circle cx="12" cy="12" r="1.4" fill="#0d9488"/>
      <line x1="12" y1="2.5" x2="12" y2="5.5" stroke="#9fe9da" stroke-width="1" stroke-linecap="round"/>
    </svg>
  `;

  function injectStyle() {
    if (document.getElementById("geonexaLoaderStyle")) return;
    const s = document.createElement("style");
    s.id = "geonexaLoaderStyle";
    s.textContent = STYLE;
    (document.head || document.documentElement).appendChild(s);
  }

  function injectOverlay() {
    if (document.getElementById("geonexaLoaderOverlay")) return;
    const div = document.createElement("div");
    div.id = "geonexaLoaderOverlay";
    div.innerHTML = `
      <div class="geonexa-orbit-stage">
        <div class="geonexa-orbit-ring"></div>
        <div class="geonexa-orbit-ring r2"></div>
        <div class="geonexa-globe"></div>
        <div class="geonexa-orbit-spin">
          <div class="geonexa-satellite">${SATELLITE_SVG}</div>
        </div>
      </div>
      <div id="geonexaLoaderTextWrap">
        <div id="geonexaLoaderBrand">GeoNEXA AI</div>
        <div id="geonexaLoaderText">Loading…</div>
        <div class="geonexa-progress"></div>
      </div>
    `;
    (document.body || document.documentElement).appendChild(div);
  }

  function mount() {
    injectStyle();
    injectOverlay();
  }

  // Show the loader. Plain and unconditional — calling it again just
  // updates the message on the same overlay.
  window.showLoader = function (message) {
    mount();
    const overlay = document.getElementById("geonexaLoaderOverlay");
    const text = document.getElementById("geonexaLoaderText");
    if (text) text.textContent = message || "Loading…";
    if (overlay) {
      overlay.classList.add("open");
      requestAnimationFrame(() => overlay.classList.add("visible"));
    }
  };

  // Hide the loader immediately — no minimum duration, no delay, no
  // counting. hideLoader() always closes it; this is deliberate so it can
  // never get stuck open from a mismatched call somewhere on the page.
  window.hideLoader = function () {
    const overlay = document.getElementById("geonexaLoaderOverlay");
    if (!overlay) return;
    overlay.classList.remove("visible");
    setTimeout(() => overlay.classList.remove("open"), 250); // let the fade finish
  };

  // Convenience wrapper: shows the loader, runs the real async work, and
  // hides the loader the instant that work finishes — whether it succeeds
  // or throws. This is the "takes as long as it actually takes" pattern.
  window.withLoader = async function (message, asyncFn) {
    window.showLoader(message);
    try {
      return await asyncFn();
    } finally {
      window.hideLoader();
    }
  };
})();
