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
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }
    passwordError.style.display = "none";

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";
    formStatus.textContent = "";
    if (window.showLoader) showLoader("Creating your account…");

    // 1. Create the auth user, passing profile fields as metadata.
    // A database trigger (handle_new_user) creates the public.profiles
    // row automatically in the same transaction — this avoids the
    // "profiles_id_fkey" race that happened when the app tried to
    // insert the profile itself right after signUp() resolved.
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: fullName,
                phone: phone,
                province: province,
                user_type: userType,
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
        // Everything typed stays right where it is — nothing on this form
        // gets cleared on failure. Scroll to the actual top of the page
        // (not just the top of the form) so the error is guaranteed to be
        // visible instead of landing mid-page, with their answers still
        // intact below it.
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }

    if (window.hideLoader) hideLoader();

    const needsVerification = ["engineer", "notary"].includes(userType);
    formStatus.textContent = needsVerification
        ? "Account created! Let's verify your professional credentials next…"
        : "Account created! Taking you to your dashboard…";
    formStatus.style.color = "#12b8ae";

    setTimeout(() => {
        window.location.href = needsVerification ? "verify-account.html" : "dashboard.html";
    }, 900);
});
