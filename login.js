// GeoNEXA AI — Login logic
// Rate limiting (max attempts + lockout) is enforced in the database via
// RPC functions — check_login_allowed / record_login_attempt. No Edge
// Function involved, so URL/slug issues can't affect login.

const loginForm = document.getElementById("loginForm");
const formStatus = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");

function formatWait(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifier = document.getElementById("identifier").value.trim();
    const password = document.getElementById("password").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";
    formStatus.textContent = "";
    if (window.showLoader) showLoader("Signing you in…");

    try {
        // 1. Ask the database whether this email is currently locked out.
        const { data: gate, error: gateErr } = await supabaseClient.rpc(
            "check_login_allowed",
            { p_email: identifier }
        );

        if (gateErr) {
            console.error("Rate-limit check failed:", gateErr);
            // Fail open rather than blocking login entirely if the RPC itself errors.
        } else if (gate && gate.allowed === false) {
            if (window.hideLoader) hideLoader();
            formStatus.textContent = `Too many failed attempts. Try again in ${formatWait(gate.retry_after_seconds)}.`;
            formStatus.style.color = "#e57373";
            submitBtn.disabled = false;
            submitBtn.textContent = "Login to GeoNEXA →";
            return;
        }

        // 2. Attempt the actual sign-in.
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: identifier,
            password,
        });

        // 3. Record the outcome for rate limiting (fire-and-forget; don't
        //    block the UI on this).
        supabaseClient.rpc("record_login_attempt", {
            p_email: identifier,
            p_success: !error,
        }).then(({ error: recordErr }) => {
            if (recordErr) console.error("Failed to record login attempt:", recordErr);
        });

        if (error) {
            if (window.hideLoader) hideLoader();
            formStatus.textContent = error.message || "Login failed. Please check your email and password.";
            formStatus.style.color = "#e57373";
            submitBtn.disabled = false;
            submitBtn.textContent = "Login to GeoNEXA →";
            return;
        }

        if (window.showLoader) showLoader("Loading your workspace…");

        // Route users to the workspace that matches their role — but first:
        // is this the owner account, is the whole site deactivated, or is
        // this specific account deactivated?
        let redirectTo = "dashboard.html";
        try {
            const { data: profile, error: profileError } = await supabaseClient
                .from("profiles")
                .select("role,user_type,is_owner,is_deactivated")
                .eq("id", data.user.id)
                .single();

            if (!profileError && profile?.is_owner) {
                // Owner always goes straight to the control page, site lock
                // or not — the owner must always be able to get in.
                redirectTo = "owner-control.html";
            } else {
                // Not the owner — check whether the whole site is closed.
                const { data: statusData } = await supabaseClient.rpc("get_site_status");
                const status = Array.isArray(statusData) ? statusData[0] : statusData;

                if (status?.maintenance_mode) {
                    if (window.hideLoader) hideLoader();
                    try {
                        sessionStorage.setItem("geonexa_maintenance_message", status.maintenance_message || "");
                    } catch (_) {}
                    await supabaseClient.auth.signOut();
                    window.location.href = "maintenance.html";
                    return;
                }

                if (!profileError && profile?.is_deactivated) {
                    redirectTo = "account-deactivated.html";
                } else {
                    const role = !profileError && profile ? String(profile.role || profile.user_type || "").toLowerCase() : "";
                    if (role === "admin") redirectTo = "admin-panel.html";
                    else if (role === "engineer" || role === "surveyor") redirectTo = "engineer-panel.html";
                }
            }
        } catch (lookupErr) {
            console.error("Role lookup failed; opening standard dashboard:", lookupErr);
        }

        formStatus.textContent = "Login successful! Redirecting…";
        formStatus.style.color = "#12b8ae";

        setTimeout(() => {
            window.location.href = redirectTo;
        }, 1200);

    } catch (err) {
        if (window.hideLoader) hideLoader();
        console.error("Login request failed:", err);
        formStatus.textContent = "Something went wrong. Please check your connection and try again.";
        formStatus.style.color = "#e57373";
        submitBtn.disabled = false;
        submitBtn.textContent = "Login to GeoNEXA →";
    }
});

// Password show/hide toggle — matches the SVG eyeOpen/eyeClosed icons
// in login.html, not the old emoji version.
const passwordToggle = document.getElementById("passwordToggle");
if (passwordToggle) {
    passwordToggle.addEventListener("click", function () {
        const input = document.getElementById("password");
        const eyeOpen = document.getElementById("eyeOpen");
        const eyeClosed = document.getElementById("eyeClosed");
        const isHidden = input.type === "password";

        input.type = isHidden ? "text" : "password";
        if (eyeOpen) eyeOpen.style.display = isHidden ? "none" : "block";
        if (eyeClosed) eyeClosed.style.display = isHidden ? "block" : "none";
        this.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
        this.title = isHidden ? "Hide password" : "Show password";
    });
}
