let session = null;
let profession = null; // 'engineer' | 'notary'

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) { location.href = "login.html"; return; }
  session = data.session;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("role, user_type, full_name, phone, public_phone, public_email, bio, province, district, sector")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) { showBlocked("Couldn't load your profile. Please try again."); return; }

  const role = (profile.role || profile.user_type || "").toLowerCase();

  if (role !== "engineer" && role !== "notary") {
    showBlocked("This page is only for verified engineers and notaries. If you've already submitted your document, it's still pending admin review — check back once it's approved.");
    return;
  }

  profession = role;
  document.getElementById("professionLabel").textContent = profession;

  if (profession === "notary") {
    // Notary public data lives on their own `notaires` row, auto-created
    // on approval — fetch that instead of profiles.
    const { data: notaire } = await supabaseClient
      .from("notaires")
      .select("phone, email, district, sector, address, bio")
      .eq("user_id", session.user.id)
      .maybeSingle();

    fillForm({
      phone: notaire?.phone || profile.phone || "",
      email: notaire?.email || "",
      district: notaire?.district || profile.district || profile.province || "",
      sector: notaire?.sector || profile.sector || "",
      address: notaire?.address || "",
      bio: notaire?.bio || "",
    });
  } else {
    document.getElementById("addressField").style.display = "none";
    fillForm({
      phone: profile.public_phone || profile.phone || "",
      email: profile.public_email || "",
      district: profile.district || profile.province || "",
      sector: profile.sector || "",
      bio: profile.bio || "",
    });
  }

  document.getElementById("formSection").style.display = "block";
  document.getElementById("saveBtn").addEventListener("click", save);
  document.getElementById("skipBtn").addEventListener("click", () => { location.href = "dashboard.html"; });
}

function fillForm(v) {
  document.getElementById("fPhone").value = v.phone || "";
  document.getElementById("fEmail").value = v.email || "";
  document.getElementById("fDistrict").value = v.district || "";
  document.getElementById("fSector").value = v.sector || "";
  if (document.getElementById("fAddress")) document.getElementById("fAddress").value = v.address || "";
  document.getElementById("fBio").value = v.bio || "";
}

function showBlocked(text) {
  document.getElementById("blockedSection").style.display = "block";
  document.getElementById("blockedText").textContent = text;
}

async function save() {
  const statusEl = document.getElementById("statusMsg");
  const btn = document.getElementById("saveBtn");
  const phone = document.getElementById("fPhone").value.trim();
  const email = document.getElementById("fEmail").value.trim();
  const district = document.getElementById("fDistrict").value.trim();
  const sector = document.getElementById("fSector").value.trim();
  const bio = document.getElementById("fBio").value.trim();
  const address = document.getElementById("fAddress") ? document.getElementById("fAddress").value.trim() : null;

  btn.disabled = true;
  btn.textContent = "Saving…";
  statusEl.textContent = "";

  let error;
  if (profession === "notary") {
    ({ error } = await supabaseClient
      .from("notaires")
      .update({ phone, email, district, sector, address, bio })
      .eq("user_id", session.user.id));
  } else {
    ({ error } = await supabaseClient
      .from("profiles")
      .update({ public_phone: phone, public_email: email, district, sector, bio })
      .eq("id", session.user.id));
  }

  btn.disabled = false;
  btn.textContent = "Save public profile";

  if (error) {
    statusEl.textContent = "Failed: " + error.message;
    statusEl.style.color = "#ff6b6b";
  } else {
    statusEl.textContent = "✓ Saved — your listing is up to date.";
    statusEl.style.color = "#22e0ab";
  }
}
