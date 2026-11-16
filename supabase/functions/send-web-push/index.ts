import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";

const cors = { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info" };
const VAPID_PUBLIC_KEY = "BMb3MKzCKqT82g57EkjMcb2b8pu3bH3UNmxZ5rtubHvXIM08iGJKOuFyYyaeH41UbbLQ5uXI2PGrgJa90u0mvzs";
const VAPID_SUBJECT = "mailto:admin@aghayemodiir.ir";

function isAllowedPushEndpoint(value: unknown): boolean {
  try {
    const u = new URL(String(value || ""));
    const host = u.hostname.toLowerCase();
    const allowed = host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && allowed;
  } catch {
    return false;
  }
}

function json(data: unknown, status=200) { return new Response(JSON.stringify(data), {status,headers:cors}); }

Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if (req.method!=="POST") return json({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL")||"", key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key) return json({error:"تنظیمات اتصال پایگاه داده ناقص است"},503);
  let input:any;
  try{
    const declared=Number(req.headers.get("content-length")||"0");
    if(Number.isFinite(declared)&&declared>32000)return json({error:"حجم درخواست بیش از حد مجاز است"},413);
    const raw=await req.text();
    if(new TextEncoder().encode(raw).byteLength>32000)return json({error:"حجم درخواست بیش از حد مجاز است"},413);
    input=JSON.parse(raw);
  }catch{return json({error:"Invalid JSON"},400);}
  const token=typeof input?.token==="string"?input.token.trim():"";
  const event=typeof input?.event==="string"?input.event:"";
  const title=typeof input?.title==="string"?input.title.trim():"";
  const body=typeof input?.body==="string"?input.body.trim():"";
  const targetId=typeof input?.target_account_id==="string"?input.target_account_id:"";
  if(!token||token.length>200||!event||!title) return json({error:"token, event and title are required"},400);
  const headers={apikey:key,Authorization:"Bearer "+key};
  const rest=async(path:string,method="GET",payload?:unknown)=>{
    const response=await fetch(url+"/rest/v1/"+path,{method,headers:{...headers,...(payload===undefined?{}:{"Content-Type":"application/json",Prefer:"return=representation"})},body:payload===undefined?undefined:JSON.stringify(payload)});
    const raw=await response.text();let data:any=null;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
    if(!response.ok) throw new Error("Database request failed ("+response.status+")");return data;
  };
  try{
    // Validate the custom session through the guarded RPC. Never put session tokens
    // in REST query strings, where request URLs may be recorded in infrastructure logs.
    let actor:any;
    try {
      actor=await rest("rpc/app_me","POST",{p_token:token});
    } catch {
      return json({error:"نشست کاربر معتبر نیست"},401);
    }
    if(!actor||typeof actor.id!=="string"||!Number.isInteger(Number(actor.building_id))||actor.is_active!==true) {
      return json({error:"نشست کاربر معتبر نیست"},401);
    }
    const activeBuilding=await rest("buildings?id=eq."+encodeURIComponent(String(actor.building_id))+"&status=eq.active&select=id&limit=1");
    if(!Array.isArray(activeBuilding)||!activeBuilding.length) return json({error:"ساختمان فعال نیست"},403);
    let recipients:any[]=[];
    const allowedEvents = ["resident_login","resident_request_created","payment_request_created","announcement_created","poll_created","group_message_created","manager_reply_created","payment_reviewed"];
    if(!allowedEvents.includes(event)) return json({error:"رویداد اعلان مجاز نیست"},400);
    if(title.length>100 || body.length>1000) return json({error:"متن اعلان بیش از حد مجاز است"},400);

    const getManagerRecipients = async () => {
      const buildings=await rest("buildings?id=eq."+encodeURIComponent(actor.building_id)+"&select=current_manager_account_id&limit=1");
      const managerId=Array.isArray(buildings)?buildings[0]?.current_manager_account_id:null;
      if(managerId){
        const current=await rest("accounts?id=eq."+encodeURIComponent(managerId)+"&building_id=eq."+encodeURIComponent(actor.building_id)+"&is_admin=eq.true&is_active=eq.true&select=id&limit=1");
        if(Array.isArray(current)&&current.length) return current;
      }
      return await rest("accounts?building_id=eq."+encodeURIComponent(actor.building_id)+"&is_admin=eq.true&is_active=eq.true&id=neq."+encodeURIComponent(actor.id)+"&select=id");
    };

    if(event==="resident_login" || event==="resident_request_created" || event==="payment_request_created"){
      if(actor.is_admin) return json({error:"این رویداد فقط برای حساب ساکن مجاز است"},403);
      recipients=await getManagerRecipients();
    }else if(event==="announcement_created" || event==="poll_created"){
      if(!actor.is_admin) return json({error:"فقط مدیر ساختمان مجاز به ارسال این نوع اعلان است"},403);
      recipients=await rest("accounts?building_id=eq."+encodeURIComponent(actor.building_id)+"&is_active=eq.true&id=neq."+encodeURIComponent(actor.id)+"&select=id");
    }else if(event==="manager_reply_created" || event==="payment_reviewed"){
      if(!actor.is_admin) return json({error:"فقط مدیر ساختمان مجاز به ارسال این نوع اعلان است"},403);
      if(!targetId) return json({error:"دریافت‌کننده اعلان معتبر نیست"},403);
      recipients=await rest("accounts?id=eq."+encodeURIComponent(targetId)+"&building_id=eq."+encodeURIComponent(actor.building_id)+"&is_active=eq.true&select=id&limit=1");
      if(!Array.isArray(recipients) || !recipients.length) return json({error:"دریافت‌کننده در این ساختمان فعال نیست"},403);
    }else if(event==="group_message_created"){
      recipients=await rest("accounts?building_id=eq."+encodeURIComponent(actor.building_id)+"&is_active=eq.true&id=neq."+encodeURIComponent(actor.id)+"&select=id");
    }
    const ids=[...new Set((Array.isArray(recipients)?recipients:[]).map((x:any)=>x?.id).filter((x:unknown)=>typeof x==="string"))];
    if(!ids.length) return json({success:true,sent:0,reason:"no_recipients"});
    const rateResponse=await fetch(url+"/rest/v1/rpc/app_claim_push_dispatch",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({p_token:token,p_event:event})});
    if(!rateResponse.ok) throw new Error("Push rate-limit check failed");
    const rateAllowed=await rateResponse.json();
    if(rateAllowed!==true) return json({error:"تعداد اعلان‌های ارسالی در مدت کوتاه بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید."},429);

    // Resident-triggered notifications must be backed by a recent, undispatched database event.
    if(["resident_login","resident_request_created","payment_request_created","group_message_created"].includes(event)){
      if(actor.is_admin && event==="group_message_created") return json({error:"این نوع اعلان برای حساب مدیر مجاز نیست"},403);
      const cutoff=encodeURIComponent(new Date(Date.now()-120000).toISOString());
      let sourceTable="", sourceFilter="";
      if(event==="resident_login"){
        sourceTable="activity_logs";
        sourceFilter="action=eq.%D9%88%D8%B1%D9%88%D8%AF&details=eq.%D9%88%D8%B1%D9%88%D8%AF%20%D9%85%D9%88%D9%81%D9%82&";
      }else if(event==="resident_request_created"){
        sourceTable="resident_requests";
      }else if(event==="payment_request_created"){
        sourceTable="payment_requests";
        sourceFilter="status=eq.pending&";
      }else{
        sourceTable="group_messages";
        sourceFilter="message=eq."+encodeURIComponent(body)+"&";
      }
      const sourceRows=await rest(sourceTable+"?account_id=eq."+encodeURIComponent(actor.id)+
        "&building_id=eq."+encodeURIComponent(actor.building_id)+"&"+sourceFilter+
        "push_dispatched_at=is.null&created_at=gt."+cutoff+
        "&select=id&order=created_at.desc&limit=1");
      if(!Array.isArray(sourceRows)||!sourceRows.length) return json({error:"برای این اعلان، رویداد معتبر و ثبت‌نشده‌ای پیدا نشد"},403);
      const sourceId=sourceRows[0]?.id;
      const claimed=await rest(sourceTable+"?id=eq."+encodeURIComponent(String(sourceId))+
        "&account_id=eq."+encodeURIComponent(actor.id)+
        "&building_id=eq."+encodeURIComponent(actor.building_id)+
        "&push_dispatched_at=is.null","PATCH",{push_dispatched_at:new Date().toISOString()});
      if(!Array.isArray(claimed)||claimed.length!==1) return json({error:"این اعلان قبلاً ارسال یا پردازش شده است"},409);
    }

    const subs=await rest("push_subscriptions?account_id=in.("+ids.map(x=>encodeURIComponent(x)).join(",")+")&select=id,endpoint,p256dh,auth");
    const vapidSecretResponse=await fetch(url+"/rest/v1/rpc/app_internal_get_vapid_private_key",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:"{}"});
    if(!vapidSecretResponse.ok) throw new Error("VAPID signing key unavailable");
    const vapidPrivateKey=await vapidSecretResponse.json();
    if(typeof vapidPrivateKey!=="string"||!vapidPrivateKey) throw new Error("VAPID signing key unavailable");
    webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,vapidPrivateKey);
    let sent=0,removed=0,failed=0;
    const rawTargetUrl=typeof input?.url==="string"?input.url:"/";
    const targetUrl=rawTargetUrl.startsWith("/")&&!rawTargetUrl.startsWith("//")&&!rawTargetUrl.includes("\\")&&!rawTargetUrl.split(/[?#]/)[0].split("/").includes("..")?rawTargetUrl:"/";
    for(const sub of(Array.isArray(subs)?subs:[])){
      if(!isAllowedPushEndpoint(sub.endpoint)){await rest("push_subscriptions?id=eq."+encodeURIComponent(sub.id),"DELETE");removed++;continue;}
      try{
        await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:title.slice(0,100),body:body.slice(0,240)||"یک رویداد جدید در ساختمان ثبت شد.",url:targetUrl,tag:event+"-"+actor.building_id+"-"+(sub.id||"push")}));
        sent++;
      }catch(error:any){
        if(error?.statusCode===404||error?.statusCode===410){await rest("push_subscriptions?id=eq."+encodeURIComponent(sub.id),"DELETE");removed++;}
        else{failed++;console.error("Push delivery failed:",error?.statusCode||error?.message||"unknown");}
      }
    }
    console.info("Push delivery result",JSON.stringify({event,sent,removed,failed,recipients:ids.length}));
    return json({success:true,sent,removed,failed,recipients:ids.length});
  }catch(error:any){console.error("send-web-push failed:",error?.message||"unknown");return json({error:"ارسال اعلان با خطای سرور روبه‌رو شد"},500);}
});