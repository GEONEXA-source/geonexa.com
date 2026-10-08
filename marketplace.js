let session = null;
let listingsCache = [];
let activeTransactionId = null;
let activeListing = null;

function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) { location.href = "login.html"; return; }
  session = data.session;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("pane-" + btn.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("createListingBtn").addEventListener("click", createListing);
  document.getElementById("closeBuyModal").addEventListener("click", closeBuyModal);
  document.getElementById("startTransactionBtn").addEventListener("click", startTransaction);
  document.getElementById("verifyOtpBtn").addEventListener("click", verifyOtp);
  document.getElementById("resendOtpBtn").addEventListener("click", startTransaction);
  document.getElementById("recordPaymentBtn").addEventListener("click", recordPayment);

  loadBrowse();
  loadMine();
}

async function loadBrowse() {
  const grid = document.getElementById("browseGrid");
  const { data, error } = await supabaseClient
    .from("land_listings")
    .select("*")
    .eq("status", "verified")
    .neq("seller_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) { grid.innerHTML = `<div class="empty-state"><p>Couldn't load listings.</p></div>`; return; }
  listingsCache = data || [];

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No listings available yet.</p></div>`;
    return;
  }

  grid.innerHTML = data.map((l) => `
    <div class="card">
      <span class="status-pill">${esc(l.status)}</span>
      <div class="listing-title" style="margin-top:8px;">${esc(l.title)}</div>
      <div class="listing-sub">${esc([l.cell, l.sector, l.district].filter(Boolean).join(", ") || "Location not specified")}</div>
      <div class="listing-price">${l.price ? Number(l.price).toLocaleString() + " " + l.currency : "Price on request"}</div>
      <button class="btn-solid" onclick="openBuyModal('${l.id}')">Buy this land</button>
    </div>
  `).join("");
}

async function loadMine() {
  const grid = document.getElementById("myGrid");
  const { data, error } = await supabaseClient
    .from("land_listings")
    .select("*")
    .eq("seller_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) { grid.innerHTML = `<div class="empty-state"><p>Couldn't load your listings.</p></div>`; return; }

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>You haven't listed anything yet.</p></div>`;
    return;
  }

  grid.innerHTML = data.map((l) => `
    <div class="card">
      <span class="status-pill">${esc(l.status)}</span>
      <div class="listing-title" style="margin-top:8px;">${esc(l.title)}</div>
      <div class="listing-sub">${esc([l.cell, l.sector, l.district].filter(Boolean).join(", ") || "Location not specified")}</div>
      <div class="listing-price">${l.price ? Number(l.price).toLocaleString() + " " + l.currency : "Price on request"}</div>
      <div style="font-size:11px;color:var(--muted);">Status is set to "draft" until an admin verifies it.</div>
    </div>
  `).join("");
}

async function createListing() {
  const btn = document.getElementById("createListingBtn");
  const statusEl = document.getElementById("sellStatus");
  const title = document.getElementById("fTitle").value.trim();

  if (!title) { statusEl.textContent = "Title is required."; statusEl.style.color = "#ff6b6b"; return; }

  btn.disabled = true;
  const { error } = await supabaseClient.from("land_listings").insert({
    seller_id: session.user.id,
    title,
    description: document.getElementById("fDesc").value.trim() || null,
    upi: document.getElementById("fUpi").value.trim() || null,
    district: document.getElementById("fDistrict").value.trim() || null,
    sector: document.getElementById("fSector").value.trim() || null,
    cell: document.getElementById("fCell").value.trim() || null,
    price: document.getElementById("fPrice").value || null,
    status: "verification_pending",
  });
  btn.disabled = false;

  if (error) {
    statusEl.textContent = "Failed: " + error.message;
    statusEl.style.color = "#ff6b6b";
  } else {
    statusEl.textContent = "Listed! It'll appear in the marketplace once an admin verifies it.";
    statusEl.style.color = "#22e0ab";
    ["fTitle","fDesc","fUpi","fDistrict","fSector","fCell","fPrice"].forEach((id) => document.getElementById(id).value = "");
    loadMine();
  }
}

// ---------- Buy / transaction flow ----------
function openBuyModal(listingId) {
  activeListing = listingsCache.find((l) => l.id === listingId);
  if (!activeListing) return;
  document.getElementById("buyModalTitle").textContent = "Buy: " + activeListing.title;
  showStep("stepInitiate");
  document.getElementById("buyModal").classList.add("open");
}

function closeBuyModal() {
  document.getElementById("buyModal").classList.remove("open");
  activeTransactionId = null;
  activeListing = null;
}

function showStep(id) {
  document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.getElementById("buyStatus").textContent = "";
}

async function startTransaction() {
  const statusEl = document.getElementById("buyStatus");
  const btn = document.getElementById("startTransactionBtn");
  btn.disabled = true;
  statusEl.textContent = "Starting…";
  statusEl.style.color = "var(--muted)";

  try {
    if (!activeTransactionId) {
      const { data, error } = await supabaseClient
        .from("marketplace_transactions")
        .insert({
          listing_id: activeListing.id,
          buyer_id: session.user.id,
          seller_id: activeListing.seller_id,
        })
        .select()
        .single();
      if (error) throw error;
      activeTransactionId = data.id;
    }

    const { error: fnErr } = await supabaseClient.functions.invoke("send-transaction-otp", {
      body: { transaction_id: activeTransactionId },
    });
    if (fnErr) throw fnErr;

    statusEl.textContent = "Code sent to your email.";
    statusEl.style.color = "#22e0ab";
    showStep("stepOtp");
  } catch (err) {
    statusEl.textContent = "Failed: " + (err.message || err);
    statusEl.style.color = "#ff6b6b";
  } finally {
    btn.disabled = false;
  }
}

async function verifyOtp() {
  const code = document.getElementById("otpInput").value.trim();
  const statusEl = document.getElementById("buyStatus");
  if (code.length !== 6) { statusEl.textContent = "Enter all 6 digits."; statusEl.style.color = "#ff6b6b"; return; }

  const { data, error } = await supabaseClient.rpc("verify_transaction_otp", {
    p_transaction_id: activeTransactionId,
    p_code: code,
  });

  if (error || !data) {
    statusEl.textContent = "Invalid or expired code.";
    statusEl.style.color = "#ff6b6b";
    return;
  }

  showStep("stepPayment");
}

async function recordPayment() {
  const statusEl = document.getElementById("buyStatus");
  const btn = document.getElementById("recordPaymentBtn");
  const method = document.getElementById("fPayMethod").value;
  const ref = document.getElementById("fPayRef").value.trim();
  const amount = document.getElementById("fPayAmount").value;

  if (!ref) { statusEl.textContent = "Payment reference is required."; statusEl.style.color = "#ff6b6b"; return; }

  btn.disabled = true;
  const { error } = await supabaseClient
    .from("marketplace_transactions")
    .update({
      status: "payment_recorded",
      payment_method: method,
      payment_reference: ref,
      payment_amount: amount || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activeTransactionId);
  btn.disabled = false;

  if (error) {
    statusEl.textContent = "Failed: " + error.message;
    statusEl.style.color = "#ff6b6b";
    return;
  }

  showStep("stepDone");
}
