// GeoNEXA AI — Signup logic

const signupForm = document.getElementById("signupForm");
const formStatus = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");
const passwordError = document.getElementById("passwordError");

signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const province = document.getElementById("province").value.trim();
    const userType = document.getElementById("userType").value;
    const interest = document.getElementById("interest").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // Password match check
    if (password !== confirmPassword) {
        passwordError.style.display = "block";
        return;
    }
    passwordError.style.display = "none";

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";
    formStatus.textContent = "";
    if (window.showLoader) showLoader("Creating your account…");

   // 1. Create the auth user, passing profile fields as metadata
const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
        data: {
            full_name: fullName,
            phone: phone,
            province: province,
            user_type: userType,
            role: userType,
            interest: interest
        }
    }
});

if (error) {
    if (window.hideLoader) hideLoader();
    formStatus.textContent = error.message;
    formStatus.style.color = "#e57373";
    submitBtn.disabled = false;
    submitBtn.textContent = "Create GeoNEXA Account →";
    return;
}

// Profile row is created automatically by the on_auth_user_created trigger.

if (window.hideLoader) hideLoader();
sessionStorage.setItem("geonexa_pending_verify_email", email);
formStatus.textContent = "Account created! Redirecting to verification…";
formStatus.style.color = "#12b8ae";

setTimeout(() => {
    window.location.href = "verify-otp.html?email=" + encodeURIComponent(email);
}, 900);

    const userId = data.user ? data.user.id : null;

    // 2. Insert extra profile fields into a "profiles" table.
    // role is set from the same userType selection so the
    // dashboards' role-based checks actually reflect what the
    // person picked. "admin" is never a valid signup selection —
    // a database trigger also blocks it server-side as a backstop
    // in case that ever changes or gets bypassed.
    if (userId) {
        const { error: profileError } = await supabaseClient
            .from("profiles")
            .insert({
                id: userId,
                full_name: fullName,
                phone: phone,
                province: province,
                user_type: userType,
                role: userType,
                interest: interest
            });

        if (profileError) {
            if (window.hideLoader) hideLoader();
            formStatus.textContent = "Account created, but profile save failed: " + profileError.message;
            formStatus.style.color = "#e57373";
            submitBtn.disabled = false;
            submitBtn.textContent = "Create GeoNEXA Account →";
            return;
        }
    }

    if (window.hideLoader) hideLoader();
    sessionStorage.setItem("geonexa_pending_verify_email", email);
    formStatus.textContent = "Account created! Redirecting to verification…";
    formStatus.style.color = "#12b8ae";

    setTimeout(() => {
        window.location.href = "verify-otp.html?email=" + encodeURIComponent(email);
    }, 900);
});
