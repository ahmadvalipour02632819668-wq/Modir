import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
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


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return json({ error: "تنظیمات اعلان سرور کامل نیست" }, 503);

  let input: any;
  try {
    const declared = Number(req.headers.get("content-length") || "0");
    if (Number.isFinite(declared) && declared > 16000) return json({ error: "حجم درخواست بیش از حد مجاز است" }, 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 16000) return json({ error: "حجم درخواست بیش از حد مجاز است" }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: "درخواست نامعتبر است" }, 400); }

  const token = typeof input?.token === "string" ? input.token.trim() : "";
  const targetUnit = Number(input?.target_unit_no);
  const category = typeof input?.category === "string" ? input.category : "";
  if (!token || token.length > 200 || !Number.isInteger(targetUnit) || targetUnit < 1 || targetUnit > 999 ||
      !["noise", "quiet_hours", "common_areas", "other"].includes(category)) {
    return json({ error: "اطلاعات هشدار کامل یا معتبر نیست" }, 400);
  }

  const headers = { apikey: key, Authorization: "Bearer " + key };
  const rest = async (path: string, method = "GET", payload?: unknown) => {
    const response = await fetch(url + "/rest/v1/" + path, {
      method,
      headers: {
        ...headers,
        ...(payload === undefined ? {} : { "Content-Type": "application/json", Prefer: "return=representation" })
      },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) throw new Error("Database request failed (" + response.status + ")");
    return data;
  };

  try {
    const rpcResponse = await fetch(url + "/rest/v1/rpc/app_neighbor_alert_submit", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_target_unit_no: targetUnit, p_category: category })
    });
    const rpcRaw = await rpcResponse.text();
    let created: any = null;
    try { created = rpcRaw ? JSON.parse(rpcRaw) : null; } catch { created = null; }
    if (!rpcResponse.ok) {
      const message = typeof created?.message === "string" ? created.message : "امکان ثبت هشدار وجود ندارد";
      const throttled = /محدودیت|سقف مجاز|۶ ساعت|۲۴ ساعت/.test(message);
      return json({ error: message }, throttled ? 429 : 400);
    }
    if (!created?.ok || !created?.building_id || !created?.alert_id) {
      return json({ error: "ثبت هشدار تأیید نشد" }, 400);
    }

    const accounts = await rest(
      "accounts?building_id=eq." + encodeURIComponent(String(created.building_id)) +
      "&unit_no=eq." + encodeURIComponent(String(created.target_unit_no)) +
      "&is_active=eq.true&select=id"
    );
    const accountIds = [...new Set((Array.isArray(accounts) ? accounts : [])
      .map((a: any) => a?.id).filter((id: unknown) => typeof id === "string"))];

    if (!accountIds.length) {
      return json({ success: true, sent: 0, alert_id: created.alert_id, reason: "no_active_accounts" });
    }

    const inFilter = "(" + accountIds.map(encodeURIComponent).join(",") + ")";
    const subscriptions = await rest(
      "push_subscriptions?account_id=in." + inFilter + "&building_id=eq." +
      encodeURIComponent(String(created.building_id)) + "&select=id,endpoint,p256dh,auth"
    );

    let sent = 0, removed = 0, failed = 0;
    if (Array.isArray(subscriptions) && subscriptions.length) {
      const privateKey = await rest("rpc/app_internal_get_vapid_private_key", "POST", {});
      if (typeof privateKey !== "string" || !privateKey) {
        return json({ success: true, sent: 0, alert_id: created.alert_id, push_error: "push_not_configured" });
      }
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);

      const labels: Record<string, string> = {
        noise: "سروصدای غیرمتعارف",
        quiet_hours: "رعایت ساعات استراحت",
        common_areas: "رعایت فضای مشاع",
        other: "یک موضوع همسایگی"
      };
      const body = "یکی از همسایه‌ها درخواست توجه به «" + labels[category] +
        "» را دارد. لطفاً به آسایش و آرامش سایر ساکنان توجه فرمایید.";
      for (const sub of subscriptions) {
        if (!isAllowedPushEndpoint(sub.endpoint)) { await rest("push_subscriptions?id=eq." + encodeURIComponent(sub.id), "DELETE"); removed++; continue; }
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: "یادآوری همسایگی",
              body,
              url: typeof input?.url === "string" && input.url.startsWith("/") && !input.url.startsWith("//") && !input.url.includes("\\") && !input.url.split(/[?#]/)[0].split("/").includes("..") ? input.url : "/",
              tag: "neighbor-alert-" + created.building_id + "-" + created.target_unit_no,
              renotify: false
            })
          );
          sent++;
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await rest("push_subscriptions?id=eq." + encodeURIComponent(sub.id), "DELETE");
            removed++;
          } else {
            failed++;
            console.error("Neighbor alert push delivery failed:", error?.statusCode || "unknown");
          }
        }
      }
    }

    return json({ success: true, sent, removed, failed, alert_id: created.alert_id });
  } catch (error: any) {
    console.error("send-neighbor-alert failed:", error?.message || "unknown");
    return json({ error: "ارسال هشدار با خطای سرور روبه‌رو شد" }, 500);
  }
});
