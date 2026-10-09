document.addEventListener("DOMContentLoaded", init);
let isOwner = false;

async function init(){
  if(window.showLoader) showLoader("Checking access…");
  const { data, error } = await supabaseClient.auth.getSession();
  if(error || !data.session){ location.href = "owner-login.html"; return; }

  const { data: prof, error: profErr } = await supabaseClient
    .from("profiles").select("is_owner").eq("id", data.session.user.id).single();

  if(profErr || !prof?.is_owner){
    if(window.hideLoader) hideLoader();
    await supabaseClient.auth.signOut();
    location.href = "owner-login.html";
    return;
  }
  isOwner = true;

  await refreshStatus();
  document.getElementById("activateBtn").addEventListener("click", () => setMode(false));
  document.getElementById("deactivateBtn").addEventListener("click", () => setMode(true));
  if(window.hideLoader) hideLoader();
}

async function refreshStatus(){
  const { data, error } = await supabaseClient.rpc("get_site_status");
  if(error) return;
  const row = Array.isArray(data) ? data[0] : data;
  const live = !row?.maintenance_mode;
  const statusEl = document.getElementById("statusText");
  statusEl.textContent = live ? "● Site is LIVE" : "● Site is in MAINTENANCE MODE";
  statusEl.style.color = live ? "#14b8a6" : "#f87171";
  document.getElementById("msgInput").value = row?.maintenance_message || "";
}

async function setMode(deactivate){
  if(!isOwner) return;
  const msg = document.getElementById("msgInput").value.trim();
  if(window.showLoader) showLoader(deactivate ? "Deactivating site…" : "Reactivating site…");

  // Force a fresh session before calling the RPC — a tab left open a
  // while can hold a stale token that getSession() alone won't catch,
  // and that's what causes "Not authenticated" here.
  const { data: refreshed, error: refreshErr } = await supabaseClient.auth.refreshSession();
  if(refreshErr || !refreshed?.session){
    if(window.hideLoader) hideLoader();
    alert("Your session expired. Please log in again.");
    location.href = "owner-login.html";
    return;
  }

  const { error } = await supabaseClient.rpc("owner_set_maintenance_mode", {
    p_active: deactivate,
    p_message: msg || null
  });

  if(window.hideLoader) hideLoader();

  if(error){
    if(String(error.message || "").toLowerCase().includes("not authenticated") ||
       String(error.message || "").toLowerCase().includes("not authorized")){
      alert("Your session expired. Please log in again.");
      location.href = "owner-login.html";
      return;
    }
    alert("Error: " + error.message);
    return;
  }
  await refreshStatus();
}
