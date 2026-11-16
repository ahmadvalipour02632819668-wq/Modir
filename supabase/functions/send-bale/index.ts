import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
async function rpc(name:string,body:Record<string,unknown>){
 const key=SERVICE_ROLE_KEY;
 return await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
async function readJsonLimited(req:Request,maxBytes:number){
 const declared=Number(req.headers.get("content-length")||"0");
 if(Number.isFinite(declared)&&declared>maxBytes)throw new Error("REQUEST_TOO_LARGE");
 const raw=await req.text();
 if(new TextEncoder().encode(raw).byteLength>maxBytes)throw new Error("REQUEST_TOO_LARGE");
 return JSON.parse(raw);
}
const validBotToken=(v:string)=>v.length>=20&&v.length<=300&&/^[A-Za-z0-9:_-]+$/.test(v);
const validChatId=(v:string)=>/^-?[0-9]{1,30}$/.test(v)||/^@[A-Za-z0-9_]{5,32}$/.test(v);

serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  if(!SERVICE_ROLE_KEY)throw new Error("تنظیم امن سرور برای اتصال بله انجام نشده است");
  const body=await readJsonLimited(req,12*1024*1024),token=String(body?.app_token||""),buildingId=Number(body?.building_id),message=String(body?.text||"").trim(),image=body?.image?String(body.image):"",action=String(body?.action||"send");
  if(!token||token.length>200||!Number.isInteger(buildingId)||buildingId<=0)return json({error:"نشست یا شناسه ساختمان معتبر نیست"},401);
  if(action!=="send"&&action!=="discover")return json({error:"عملیات بله معتبر نیست"},400);
  if(action!=="discover"&&(!message||message.length>4000))return json({error:"متن اعلان نامعتبر است"},400);
  if(image.length>11200000)return json({error:"حجم تصویر بیشتر از حد مجاز است"},413);
  const auth=await rpc("app_bale_authorize",{p_token:token,p_building_id:buildingId});
  if(!auth.ok||(await auth.json())!==true)return json({error:"دسترسی به اعلان‌های این ساختمان تأیید نشد"},403);
  if(action==="discover"){ 
   const discoverAuth=await rpc("app_bale_discover_authorize",{p_token:token,p_building_id:buildingId});
   if(!discoverAuth.ok||(await discoverAuth.json())!==true)return json({error:"یافتن گروه‌های بله فقط برای مدیر ساختمان مجاز است"},403);
  }
  const rate=await rpc("app_claim_bale_dispatch",{p_token:token,p_action:action});
  if(!rate.ok)throw new Error("بررسی محدودیت ارسال بله ناموفق بود");
  if((await rate.json())!==true)return json({error:"تعداد درخواست‌های بله در مدت کوتاه بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید."},429);
  const cfgRes=await rpc("app_internal_get_bale_config",{p_building_id:buildingId});
  if(!cfgRes.ok)throw new Error("خواندن تنظیمات اتصال بله ناموفق بود");
  const cfg=await cfgRes.json();
  if(action==="discover"){
   const discoveryToken=String(body?.bot_token||cfg?.bot_token||"").trim();
   if(!validBotToken(discoveryToken))return json({success:false,error:"توکن ربات معتبر نیست"},400);
   const updatesResponse=await fetch(`https://tapi.bale.ai/bot${discoveryToken}/getUpdates`,{signal:AbortSignal.timeout(12000)});
   const updatesData=await updatesResponse.json().catch(()=>({}));
   if(!updatesResponse.ok||updatesData.ok===false){
    const detail=updatesData.description||"";
    return json({success:false,error:updatesResponse.status===404?"سرویس دریافت خودکار پیام‌ها در این نشانی بله پاسخ نمی‌دهد؛ اتصال فعلی دست‌نخورده باقی مانده است.":(detail||"دریافت پیام‌های ربات ناموفق بود")});
   }
   const updates=Array.isArray(updatesData.result)?updatesData.result:[];
   const chats=new Map<string,{id:string,title:string,type:string}>();
   for(const u of updates){
    const chat=u?.message?.chat||u?.edited_message?.chat||u?.channel_post?.chat||u?.my_chat_member?.chat||u?.chat_member?.chat;
    if(chat&&chat.id!==undefined&&chat.type!=="private"){
     const id=String(chat.id);
     chats.set(id,{id,title:String(chat.title||chat.username||("گروه "+id)),type:String(chat.type||"group")});
    }
   }
   return json({success:true,chats:[...chats.values()],message:updates.length?"در پیام‌های دریافتی ربات، گروهی پیدا نشد. در گروه یک پیام تازه بفرستید و دوباره تلاش کنید.":"هنوز پیامی به ربات نرسیده است. در گروه یک پیام تازه بفرستید و دوباره تلاش کنید."});
  }
  if(!validBotToken(String(cfg?.bot_token||""))||!validChatId(String(cfg?.chat_id||"")))return json({error:"تنظیمات اتصال بله معتبر نیست"},409);
  let sent:Response;
  if(image){
   const match=image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
   if(!match)return json({error:"فرمت تصویر گزارش معتبر نیست"},400);
   const binary=atob(match[2]); if(binary.length>8*1024*1024)return json({error:"حجم تصویر بیشتر از حد مجاز است"},413);
   const bytes=new Uint8Array(binary.length); for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   const form=new FormData(); form.append("chat_id",String(cfg.chat_id)); form.append("caption",message.slice(0,1000));
   form.append("photo",new Blob([bytes],{type:match[1]}),"report.jpg");
   sent=await fetch(`https://tapi.bale.ai/bot${cfg.bot_token}/sendPhoto`,{method:"POST",body:form,signal:AbortSignal.timeout(12000)});
  }else{
   sent=await fetch(`https://tapi.bale.ai/bot${cfg.bot_token}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:cfg.chat_id,text:message}),signal:AbortSignal.timeout(12000)});
  }
  const result=await sent.json().catch(()=>({}));
  if(!sent.ok||result.ok===false||result.error)return json({error:result.description||result.error||"ارسال به بله ناموفق بود"},502);
  return json({success:true});
 }catch(e){if(e instanceof Error&&e.message==="REQUEST_TOO_LARGE")return json({error:"حجم درخواست بیشتر از حد مجاز است"},413);return json({error:e instanceof Error?e.message:"خطای نامشخص"},500);}
});