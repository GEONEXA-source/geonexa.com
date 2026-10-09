let session = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (window.showLoader) showLoader("Loading your workspace…");

  const { data: sessionData, error: sessionErr } = await supabaseClient.auth.getSession();
  if (sessionErr || !sessionData.session) { location.href = "login.html"; return; }
  session = sessionData.session;

  const { data: profile, error: profileErr } = await supabaseClient
    .from("profiles")
    .select("role, user_type")
    .eq("id", session.user.id)
    .single();

  if (window.hideLoader) hideLoader();

  if (profileErr || !profile) {
    showBlocked("Couldn't load your profile. Please try again.");
    return;
  }

  const role = (profile.role || profile.user_type || "").toLowerCase();

  if (role !== "notary") {
    if (role === "admin") { location.href = "admin-panel.html"; return; }
    if (role === "engineer") { location.href = "engineer-panel.html"; return; }
    showBlocked("This workspace is only for verified notaries. If you've requested notary verification, it's still pending admin review — check Users & Access for status.");
    return;
  }

  const { data: notaire } = await supabaseClient
    .from("notaires")
    .select("phone, email, district, sector, address, bio")
    .eq("user_id", session.user.id)
    .maybeSingle();

  document.getElementById("nName").textContent = session.user.email || "—";
  document.getElementById("nPhone").textContent = notaire?.phone || "—";
  document.getElementById("nEmail").textContent = notaire?.email || "—";
  document.getElementById("nDistrict").textContent = notaire?.district || "—";
  document.getElementById("nSector").textContent = notaire?.sector || "—";
  document.getElementById("nAddress").textContent = notaire?.address || "—";
  document.getElementById("nBio").textContent = notaire?.bio || "—";

  document.getElementById("loadingState").style.display = "none";
  document.getElementById("content").style.display = "block";

  document.getElementById("signOut").addEventListener("click", async () => {
    if (window.showLoader) showLoader("Signing out…");
    await supabaseClient.auth.signOut();
    location.href = "login.html";
  });
}

function showBlocked(text) {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("blockedSection").style.display = "block";
  document.getElementById("blockedText").textContent = text;
}
