// GeoNEXA AI — drives the glassy OTP animations (filled / checking / success / error).
(function () {
  function init() {
    var row = document.querySelector(".otp-row");
    if (!row) return;
    document.body.classList.add("gx-glass");
    var inputs = Array.prototype.slice.call(row.querySelectorAll("input"));
    var btn = document.getElementById("verifyBtn") || document.getElementById("verify-otp-btn");

    inputs.forEach(function (i) {
      i.addEventListener("input", function () {
        i.classList.toggle("gx-filled", !!i.value);
        row.classList.remove("gx-bad");
      });
    });

    function clear() { row.classList.remove("gx-checking", "gx-ok", "gx-bad"); }
    function failed() {
      var e = document.getElementById("otp-error");
      if (e && e.classList.contains("show")) return true;
      var s = document.getElementById("status");
      return !!(s && s.textContent && /rgb\(255,\s*107,\s*107\)|#ff6b6b/i.test(s.style.color));
    }
    function done() {
      var s = document.getElementById("status");
      return !!(s && /^verified/i.test(s.textContent.trim()));
    }
    function settle() {
      row.classList.remove("gx-checking");
      if (failed()) {
        void row.offsetWidth; row.classList.add("gx-bad");
        setTimeout(function () { row.classList.remove("gx-bad"); }, 1400);
      } else {
        row.classList.add("gx-ok");
        setTimeout(function () { row.classList.remove("gx-ok"); }, 1500);
      }
    }

    if (btn) {
      var checking = false;
      new MutationObserver(function () {
        var t = btn.textContent || "";
        if (/verifying/i.test(t)) { checking = true; clear(); row.classList.add("gx-checking"); }
        else if (checking) { checking = false; setTimeout(settle, 60); }
      }).observe(btn, { childList: true, characterData: true, subtree: true });
    }
    // verify-otp.html: success text is set right after the button stays disabled
    var st = document.getElementById("status");
    if (st) new MutationObserver(function () {
      if (done()) { row.classList.remove("gx-checking", "gx-bad"); row.classList.add("gx-ok"); }
    }).observe(st, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
