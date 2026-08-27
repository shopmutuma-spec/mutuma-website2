const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY || "";
const MAILERLITE_TRACKING_GROUP_ID = process.env.MAILERLITE_TRACKING_GROUP_ID || "";

function cleanText(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
}

function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function hasMailerLiteTrackingConfig() {
    return Boolean(MAILERLITE_API_KEY && MAILERLITE_TRACKING_GROUP_ID);
}

export async function queueTrackingEmail({
    email,
    name,
    orderNumber,
    trackingUrl,
    deliveryEstimate = "5-8 business days once dispatched"
}) {
    const customerEmail = cleanText(email, 180).toLowerCase();

    if (!hasMailerLiteTrackingConfig() || !isEmail(customerEmail)) {
        return { ok: false, skipped: true };
    }

    const response = await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${MAILERLITE_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({
            email: customerEmail,
            fields: {
                name: cleanText(name, 120),
                order_number: cleanText(orderNumber, 80),
                tracking_url: cleanText(trackingUrl, 500),
                delivery_estimate: cleanText(deliveryEstimate, 120)
            },
            groups: [MAILERLITE_TRACKING_GROUP_ID]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "MailerLite tracking email could not be queued.");
    }

    return { ok: true };
}
