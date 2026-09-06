export async function syncNewsletter(email) {
    const key = process.env.MAILERLITE_API_KEY;
    const group = process.env.MAILERLITE_GROUP_ID;
    if (!key || !group) throw new Error("Newsletter integration is not configured.");
    const response = await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST", signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        // Never override an existing unsubscribe or suppression status.
        body: JSON.stringify({ email, groups: [group] })
    });
    if (!response.ok) throw new Error("Newsletter sync failed.");
}
