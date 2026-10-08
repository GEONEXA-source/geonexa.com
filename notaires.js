function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }

document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) { location.href = "login.html"; return; }

  document.getElementById("filterBtn").addEventListener("click", () => loadNotaires(document.getElementById("filterInput").value.trim()));
  document.getElementById("filterInput").addEventListener("keydown", (e) => { if (e.key === "Enter") loadNotaires(e.target.value.trim()); });

  loadNotaires("");
});

async function loadNotaires(query) {
  const grid = document.getElementById("notaireGrid");
  grid.innerHTML = `<div class="empty-state"><p>Loading…</p></div>`;

  let req = supabaseClient
    .from("notaires")
    .select("full_name,phone,email,district,sector,address,license_number,bio")
    .eq("verified", true);
  if (query) {
    req = req.or(`district.ilike.%${query}%,sector.ilike.%${query}%`);
  }
  const { data, error } = await req.order("full_name");

  if (error) { grid.innerHTML = `<div class="empty-state"><p>Couldn't load notaires.</p></div>`; return; }

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No verified notaires found${query ? " for that location" : " yet"}.</p></div>`;
    return;
  }

  grid.innerHTML = data.map((n) => `
    <div class="card">
      <div class="n-name">⚖️ ${esc(n.full_name)}</div>
      <div class="n-loc">${esc([n.sector, n.district].filter(Boolean).join(", ") || "Location not specified")}</div>
      ${n.phone ? `<div class="n-row"><span class="label">Phone</span><span>${esc(n.phone)}</span></div>` : ""}
      ${n.email ? `<div class="n-row"><span class="label">Email</span><span>${esc(n.email)}</span></div>` : ""}
      ${n.address ? `<div class="n-row"><span class="label">Address</span><span>${esc(n.address)}</span></div>` : ""}
      ${n.license_number ? `<div class="n-row"><span class="label">License</span><span>${esc(n.license_number)}</span></div>` : ""}
      ${n.bio ? `<div class="n-row" style="margin-top:4px;color:var(--text);">${esc(n.bio)}</div>` : ""}
    </div>
  `).join("");
}
