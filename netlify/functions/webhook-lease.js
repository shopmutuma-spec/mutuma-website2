import { supabaseRequest } from "./supabase-client.js";

const LEASE_MS = 5 * 60 * 1000;

export async function claimWebhook(event, now = Date.now()) {
    const path = `stripe_webhook_events?event_id=eq.${encodeURIComponent(event.id)}`;
    const inserted = await supabaseRequest("stripe_webhook_events?on_conflict=event_id", {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
        body: JSON.stringify([{ event_id: event.id, event_type: event.type, status: "processing" }])
    });
    if (inserted?.length) return { state: "claimed", path, token: inserted[0].updated_at };
    const [existing] = await supabaseRequest(`${path}&select=status,updated_at&limit=1`);
    if (existing?.status === "processed") return { state: "processed" };
    if (!existing?.updated_at) throw new Error("Webhook record is unavailable.");
    if (existing.status === "processing" && now - Date.parse(existing.updated_at) < LEASE_MS) return { state: "busy" };
    // Compare-and-set prevents two retries from taking the same expired lease.
    const rows = await supabaseRequest(`${path}&updated_at=eq.${encodeURIComponent(existing.updated_at)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "processing", error_message: "" })
    });
    return rows?.length ? { state: "claimed", path, token: rows[0].updated_at } : { state: "busy" };
}

export async function finishWebhook(lease, status) {
    if (!lease.token) throw new Error("Webhook lease is missing.");
    const rows = await supabaseRequest(`${lease.path}&updated_at=eq.${encodeURIComponent(lease.token)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, processed_at: new Date().toISOString(), error_message: status === "failed" ? "Processing failed; retry required." : "" })
    });
    if (!rows?.length) throw new Error("Webhook lease expired.");
}
