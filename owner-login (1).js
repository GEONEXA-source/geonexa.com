document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginForm").addEventListener("submit", onSubmit);
});

async function onSubmit(e){
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const status = document.getElementById("status");
  status.textContent = "";

  if(window.showLoader) showLoader("Checking…");

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if(error){
    if(window.hideLoader) hideLoader();
    status.textContent = "Incorrect email or password.";
    return;
  }

  const { data: prof, error: profErr } = await supabaseClient
    .from("profiles").select("is_owner").eq("id", data.user.id).single();

  if(window.hideLoader) hideLoader();

  if(profErr || !prof?.is_owner){
    await supabaseClient.auth.signOut();
    status.textContent = "This account doesn't have owner access.";
    return;
  }

  location.href = "owner-control.html";
}
