// GeoNEXA AI — Alerts logic
// Requires config.js to be loaded first (it defines `supabaseClient`)

let allAlerts = [];
let activeFilter = "all";

document.addEventListener("DOMContentLoaded", async () => {
  if (window.showLoader) showLoader("Loading your workspace…");
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error || !session) {
    if (window.hideLoader) hideLoader();
    window.location.href = "login.html";
    return;
  }

  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sidebar = document.getElementById("sidebar");
  if (hamburgerBtn && sidebar) hamburgerBtn.addEventListener("click", () => sidebar.classList.toggle("open"));

  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeFilter = tab.dataset.filter;
      render();
    });
  });

  await loadAlerts();
});

async function loadAlerts() {
  const subtitleEl = document.getElementById("subtitle");
  if (window.showLoader) showLoader("Loading alerts…");
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    const [{ data: alertRows, error: alertErr }, { data: notifRows, error: notifErr }, { data: profile }] = await Promise.all([
      supabaseClient.from("alerts").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseClient.from("notifications").select("id,title,body,created_at")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false }).limit(50),
      supabaseClient.from("profiles").select("notifications_last_seen_at").eq("id", session.user.id).single(),
    ]);

    if (alertErr) throw alertErr;

    const lastSeen = profile?.notifications_last_seen_at || "1970-01-01";
    const announcements = (notifRows || []).map((n) => ({
      id: `announcement-${n.id}`,
      title: n.title,
      message: n.body || "",
      category: "announcement",
      severity: "info",
      created_at: n.created_at,
      is_read: new Date(n.created_at) <= new Date(lastSeen),
      is_announcement: true,
    }));

    allAlerts = [...(alertRows || []), ...announcements].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    render();

    // Opening the page counts as having seen all current announcements.
    if (announcements.some((a) => !a.is_read)) {
      await supabaseClient.rpc("mark_notifications_seen");
    }
  } catch (err) {
    console.error("Alerts load failed:", err);
    subtitleEl.textContent = "Unable to load";
    document.getElementById("alertsList").innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>Couldn't load alerts. Make sure the alerts table is exposed in Supabase → Settings → API.</p></div>`;
  } finally {
    if (window.hideLoader) hideLoader();
  }
}

function render() {
  const listEl = document.getElementById("alertsList");
  const subtitleEl = document.getElementById("subtitle");

  let rows = allAlerts;
  if (activeFilter === "unread") rows = rows.filter((a) => !a.is_read);
  else if (activeFilter !== "all") rows = rows.filter((a) => a.category === activeFilter);

  const unreadCount = allAlerts.filter((a) => !a.is_read).length;
  subtitleEl.textContent = `${allAlerts.length} total · ${unreadCount} unread`;

  if (rows.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔔</div>
        <p>${allAlerts.length === 0
          ? "No alerts yet. You'll see boundary disputes, risk updates, report completions, and billing notices here as they happen."
          : "No alerts match this filter."}</p>
      </div>`;
    return;
  }

  listEl.innerHTML = rows.map(alertHTML).join("");
  wireMarkRead();
}

function alertHTML(a) {
  if (a.is_announcement) {
    const date = new Date(a.created_at).toLocaleString();
    return `
      <div class="alert-card ${a.is_read ? "" : "unread"}" data-id="${a.id}">
        <span class="severity-dot" style="background:var(--teal,#22e0ab);"></span>
        <div class="alert-body">
          <div class="alert-title">📢 ${escapeHTML(a.title)}</div>
          <div class="alert-message">${escapeHTML(a.message)}</div>
          <div class="alert-meta">${date} · Announcement</div>
        </div>
      </div>`;
  }

  const colors = { info: "var(--blue)", warning: "var(--yellow)", critical: "var(--red)" };
  const color = colors[a.severity] || "var(--blue)";
  const date = new Date(a.created_at).toLocaleString();

  return `
    <div class="alert-card ${a.is_read ? "" : "unread"}" data-id="${a.id}">
      <span class="severity-dot" style="background:${color};"></span>
      <div class="alert-body">
        <div class="alert-title">${escapeHTML(a.title)}</div>
        <div class="alert-message">${escapeHTML(a.message)}</div>
        <div class="alert-meta">${date} · ${escapeHTML(a.category)}</div>
      </div>
      ${a.is_read ? "" : `<button class="mark-read-btn" data-id="${a.id}">Mark read</button>`}
    </div>`;
}

function wireMarkRead() {
  document.querySelectorAll(".mark-read-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      if (window.showLoader) showLoader("Updating…");
      try {
        const { error } = await supabaseClient.from("alerts").update({ is_read: true }).eq("id", id);
        if (error) throw error;
        const alert = allAlerts.find((a) => a.id === id);
        if (alert) alert.is_read = true;
        render();
      } catch (err) {
        console.error("Mark read failed:", err);
        btn.disabled = false;
        alert("Couldn't mark as read: " + (err.message || err));
      } finally {
        if (window.hideLoader) hideLoader();
      }
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
