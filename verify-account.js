let session = null;
let profession = "engineer"; // default; overridden below from the account's chosen role

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) { location.href = "login.html"; return; }
  session = data.session;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("role, user_type")
    .eq("id", session.user.id)
    .single();

  const role = (profile?.role || profile?.user_type || "").toLowerCase();
  profession = role === "notary" ? "notary" : "engineer";
  document.getElementById("professionLabel").textContent = profession === "notary" ? "notary" : "engineer";

  document.getElementById("submitBtn").addEventListener("click", submitVerification);
  checkExistingStatus();
}

async function checkExistingStatus() {
  const { data } = await supabaseClient
    .from("professional_verifications")
    .select("status, created_at, rejection_reason")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return; // no submission yet — show the upload form

  if (data.status === "approved") {
    showPending("✓", "Your account is verified! Taking you to set up your public profile…", "#22e0ab");
    setTimeout(() => { window.location.href = "professional-profile-setup.html"; }, 1800);
  } else if (data.status === "rejected") {
    document.getElementById("uploadSection").style.display = "block";
    document.getElementById("statusMsg").textContent = "Your last submission was rejected" + (data.rejection_reason ? `: ${data.rejection_reason}` : "") + ". You can submit again below.";
    document.getElementById("statusMsg").style.color = "#ff6b6b";
  } else {
    showPending("⏳", "Your document is under review. This typically takes 24–48 hours — check back here anytime.", "#8b99a6");
  }
}

function showPending(icon, text, color) {
  document.getElementById("uploadSection").style.display = "none";
  document.getElementById("pendingSection").style.display = "block";
  document.getElementById("pendingIcon").textContent = icon;
  document.getElementById("pendingText").textContent = text;
  document.getElementById("pendingText").style.color = color;
}

async function submitVerification() {
  const fileInput = document.getElementById("fDoc");
  const statusEl = document.getElementById("statusMsg");
  const btn = document.getElementById("submitBtn");
  const file = fileInput.files[0];

  if (!file) {
    statusEl.textContent = "Please choose a file first.";
    statusEl.style.color = "#ff6b6b";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Uploading…";
  statusEl.textContent = "";

  try {
    const ext = file.name.split(".").pop();
    const path = `${session.user.id}/${profession}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabaseClient.storage
      .from("verification-docs")
      .upload(path, file);
    if (uploadErr) throw uploadErr;

    const { error: insertErr } = await supabaseClient
      .from("professional_verifications")
      .insert({ user_id: session.user.id, profession, document_url: path });
    if (insertErr) throw insertErr;

    showPending("⏳", "Submitted! Your document is under review — this typically takes 24–48 hours.", "#8b99a6");
  } catch (err) {
    statusEl.textContent = "Failed: " + (err.message || err);
    statusEl.style.color = "#ff6b6b";
    btn.disabled = false;
    btn.textContent = "Upload & Submit for Review";
  }
}
