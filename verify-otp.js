
// GeoNEXA AI — Signup OTP verification
// Requires: Supabase Dashboard → Authentication → Email Templates →
// "Confirm signup" must include {{ .Token }} somewhere in the body
// (e.g. "Your GeoNEXA verification code is {{ .Token }}"), otherwise
// users never actually receive a 6-digit code to type in here.

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") === "login" ? "login" : "signup";
const email = params.get("email") || sessionStorage.getItem("geonexa_pending_verify_email") || "";

const emailLabel = document.getElementById("emailLabel");
const statusEl = document.getElementById("status");
const verifyBtn = document.getElementById("verifyBtn");
const resendBtn = document.getElementById("resendBtn");
const digits = Array.from(document.querySelectorAll(".otp-digit"));

if (email) emailLabel.textContent = email;
if (mode === "login") {
  const h1 = document.querySelector("h1");
  if (h1) h1.textContent = "Verify it's you";
  verifyBtn.textContent = "Verify & Sign in →";
}

// Auto-advance between the 6 boxes, and allow pasting the full code.
digits.forEach((input, i) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);
    if (input.value && digits[i + 1]) digits[i + 1].focus();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && digits[i - 1]) digits[i - 1].focus();
  });
  input.addEventListener("paste", (e) => {
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, digits.length);
    if (pasted.length) {
      e.preventDefault();
      pasted.split("").forEach((ch, idx) => { if (digits[idx]) digits[idx].value = ch; });
      digits[Math.min(pasted.length, digits.length) - 1].focus();
    }
  });
});

function getCode() {
  return digits.map((d) => d.value).join("");
}

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ff6b6b" : "#22e0ab";
}

async function verify() {
  const code = getCode();
  if (code.length !== digits.length) {
    setStatus("Enter all " + digits.length + " digits.", true);
    return;
  }
  if (!email) {
    setStatus("Missing email — go back and sign up again.", true);
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Verifying…";
  setStatus("");

  const { data, error } = await supabaseClient.auth.verifyOtp({
    email,
    token: code,
    type: mode === "login" ? "email" : "signup",
  });

  if (error) {
    setStatus(error.message || "Invalid or expired code.", true);
    verifyBtn.disabled = false;
    verifyBtn.textContent = mode === "login" ? "Verify & Sign in →" : "Verify & Continue →";
    return;
  }

  const dest = sessionStorage.getItem("geonexa_post_verify_dest") || "dashboard.html";
  sessionStorage.removeItem("geonexa_pending_verify_email");
  sessionStorage.removeItem("geonexa_post_verify_dest");
  setStatus("Verified! Taking you in…", false);
  setTimeout(() => { window.location.href = dest; }, 800);
}

async function resend() {
  if (!email) {
    setStatus("Missing email — go back and sign up again.", true);
    return;
  }
  resendBtn.disabled = true;
  setStatus("Sending a new code…", false);

  const { error } = mode === "login"
    ? await supabaseClient.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    : await supabaseClient.auth.resend({ type: "signup", email });

  if (error) {
    setStatus(error.message || "Couldn't resend code.", true);
  } else {
    setStatus("New code sent — check your email.", false);
  }

  setTimeout(() => { resendBtn.disabled = false; }, 20000); // 20s cooldown
}

verifyBtn.addEventListener("click", verify);
resendBtn.addEventListener("click", resend);
digits[0]?.focus();
