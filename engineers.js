function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }
let currentUserId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) { location.href = "login.html"; return; }
  currentUserId = data.session.user.id;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("pane-" + btn.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("goVerifyBtn").addEventListener("click", () => {
    location.href = "verify-account.html";
  });

  loadEngineers();
  loadMyVerificationStatus();
});

async function loadEngineers() {
  const grid = document.getElementById("engineerGrid");
  const { data, error } = await supabaseClient.rpc("get_verified_engineers");

  if (error) { grid.innerHTML = `<div class="empty-state"><p>Couldn't load engineers.</p></div>`; return; }

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No verified engineers listed yet.</p></div>`;
    return;
  }

  grid.innerHTML = data.map((e) => `
    <div class="card">
      <div class="e-name">👷 ${esc(e.full_name || "Engineer")}</div>
      ${(e.district || e.sector || e.province) ? `<div class="e-row">📍 ${esc([e.sector, e.district || e.province].filter(Boolean).join(", "))}</div>` : ""}
      ${e.phone ? `<div class="e-row">📞 ${esc(e.phone)}</div>` : ""}
      ${e.email ? `<div class="e-row">✉️ ${esc(e.email)}</div>` : ""}
      ${e.bio ? `<div class="e-row" style="margin-top:6px;color:var(--text);">${esc(e.bio)}</div>` : ""}
    </div>
  `).join("");
}

// This reads the real professional_verifications table (not the old,
// now-renamed engineer_verifications table) so it reflects the actual
// admin review status instead of silently failing against a table that
// no longer exists.
async function loadMyVerificationStatus() {
  const el = document.getElementById("verificationStatusDisplay");
  const { data, error } = await supabaseClient
    .from("professional_verifications")
    .select("status, created_at, rejection_reason, profession")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) { el.textContent = ""; return; }

  const labels = { pending: "⏳ Pending review", approved: "✓ Approved", rejected: "✕ Rejected" };
  el.textContent = `Latest submission (${data.profession}): ${labels[data.status] || data.status}` + (data.rejection_reason ? ` — ${data.rejection_reason}` : "");
}
