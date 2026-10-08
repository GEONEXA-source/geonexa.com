// Drop <script src="maintenance-guard.js"></script> right after
// config.js on any page you want protected. It silently does nothing
// if the site is live or if the visitor is the owner account.
(async function(){
  try{
    const { data, error } = await supabaseClient.rpc("get_site_status");
    if(error || !data) return;
    const row = Array.isArray(data) ? data[0] : data;
    if(!row?.maintenance_mode) return;

    // Let the owner through no matter what.
    const { data: sess } = await supabaseClient.auth.getSession();
    if(sess?.session){
      const { data: prof } = await supabaseClient
        .from("profiles").select("is_owner").eq("id", sess.session.user.id).single();
      if(prof?.is_owner) return;
    }

    if(!location.pathname.endsWith("maintenance.html")){
      try{ sessionStorage.setItem("geonexa_maintenance_message", row.maintenance_message || ""); }catch(_){}
      location.href = "maintenance.html";
    }
  }catch(_){ /* fail open — never trap visitors behind a broken check */ }
})();
