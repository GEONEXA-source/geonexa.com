let session = null;
let currentRole = "individual";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (window.showLoader) showLoader("Loading your profile…");

  const { data: sessionData, error: sessionErr } = await supabaseClient.auth.getSession();
  if (sessionErr || !sessionData.session) { location.href = "login.html"; return; }
  session = sessionData.session;

  const { data: profile, error: profileErr } = await supabaseClient
    .from("profiles")
    .select("full_name, phone, role, user_type, province")
    .eq("id", session.user.id)
    .single();

  if (window.hideLoader) hideLoader();

  if (profileErr || !profile) {
    document.getElementById("loadingState").textContent = "Couldn't load your profile. Please try again.";
    return;
  }

  currentRole = (profile.role || profile.user_type || "individual").toLowerCase();

  document.getElementById("pName").textContent = profile.full_name || "—";
  document.getElementById("pEmail").textContent = session.user.email || "—";
  document.getElementById("pPhone").textContent = profile.phone || "—";
  document.getElementById("pProvince").textContent = profile.province || "—";
  document.getElementById("pRole").textContent = capitalize(currentRole);

  document.getElementById("loadingState").style.display = "none";
  document.getElementById("content").style.display = "block";

  await loadVerificationStatus();
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function loadVerificationStatus() {
  const body = document.getElementById("verificationBody");

  // Already approved — role itself was promoted on approval.
  if (currentRole === "engineer" || currentRole === "notary") {
    const panel = currentRole === "engineer" ? "engineer-panel.html" : "notary-panel.html";
    body.innerHTML = `
      <span class="badge approved">Verified ${capitalize(currentRole)}</span>
      <p class="msg" style="margin-top:14px;">You're a verified ${currentRole}. Your public listing is live and you have access to your workspace.</p>
      <a class="linkbtn" href="${panel}">Go to my workspace →</a>
      <a class="linkbtn secondary" href="professional-profile-setup.html">Edit my public profile</a>
    `;
    return;
  }

  if (currentRole === "admin") {
    body.innerHTML = `<p class="msg">Admin accounts don't need professional verification.</p>`;
    return;
  }

  // Not yet approved — check for an existing request.
  const { data: rows } = await supabaseClient
    .from("professional_verifications")
    .select("id, profession, status, rejection_reason, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = rows && rows[0];

  if (latest && latest.status === "pending") {
    body.innerHTML = `
      <span class="badge pending">Pending review</span>
      <p class="msg" style="margin-top:14px;">Your request to become a ${capitalize(latest.profession)} is submitted and waiting for admin review. You'll be notified once it's approved.</p>
    `;
    return;
  }

  let rejectedNote = "";
  if (latest && latest.status === "rejected") {
    rejectedNote = `
      <span class="badge rejected">Previous request rejected</span>
      <p class="msg" style="margin-top:10px;">${escapeHtml(latest.rejection_reason || "No reason given.")}</p>
      <p class="msg">You can submit a new request below.</p>
    `;
  } else {
    rejectedNote = `<p class="msg">Want to become a verified Engineer or Notary? Upload your certificate or diploma and an admin will review it.</p>`;
  }

  body.innerHTML = `
    ${rejectedNote}
    <label for="professionSelect">I want to become a</label>
    <select id="professionSelect">
      <option value="engineer">Engineer / Surveyor</option>
      <option value="notary">Notary</option>
    </select>
    <label for="docInput">Certificate or diploma (PDF or image)</label>
    <input type="file" id="docInput" accept=".pdf,image/*">
    <button id="submitBtn">Submit for review</button>
    <div id="statusMsg"></div>
  `;

  document.getElementById("submitBtn").addEventListener("click", submitVerification);
}

async function submitVerification() {
  const btn = document.getElementById("submitBtn");
  const statusMsg = document.getElementById("statusMsg");
  const profession = document.getElementById("professionSelect").value;
  const fileInput = document.getElementById("docInput");
  const file = fileInput.files[0];

  statusMsg.textContent = "";
  statusMsg.style.color = "#f87171";

  if (!file) {
    statusMsg.textContent = "Please choose a file to upload.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Uploading…";
  if (window.showLoader) showLoader("Uploading your document…");

  const path = `${session.user.id}/${Date.now()}_${file.name}`;

  const { error: uploadErr } = await supabaseClient
    .storage
    .from("verification-docs")
    .upload(path, file);

  if (uploadErr) {
    if (window.hideLoader) hideLoader();
    statusMsg.textContent = "Upload failed: " + uploadErr.message;
    btn.disabled = false;
    btn.textContent = "Submit for review";
    return;
  }

  const { error: insertErr } = await supabaseClient
    .from("professional_verifications")
    .insert({
      user_id: session.user.id,
      profession: profession,
      document_url: path,
      status: "pending"
    });

  if (window.hideLoader) hideLoader();

  if (insertErr) {
    statusMsg.textContent = "Couldn't submit request: " + insertErr.message;
    btn.disabled = false;
    btn.textContent = "Submit for review";
    return;
  }

  statusMsg.style.color = "#14b8a6";
  statusMsg.textContent = "Submitted! Reloading…";
  setTimeout(() => location.reload(), 900);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}
