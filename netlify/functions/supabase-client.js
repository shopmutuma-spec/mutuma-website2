function keyFromDictionary(value) {
    if (!value) return "";
    try {
        const keys = JSON.parse(value);
        return String(keys?.default || Object.values(keys || {})[0] || "").trim();
    } catch (error) {
        return "";
    }
}

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVER_KEY = String(
    process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || keyFromDictionary(process.env.SUPABASE_SECRET_KEYS)
    || ""
).trim();
const SUPABASE_PUBLIC_KEY = String(
    process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || keyFromDictionary(process.env.SUPABASE_PUBLISHABLE_KEYS)
    || ""
).trim();

function normalizeSupabaseUrl(value) {
    const rawValue = String(value || "").trim();
    if (!rawValue) return "";

    try {
        const url = new URL(rawValue.startsWith("http") ? rawValue : `https://${rawValue}`);
        return url.origin;
    } catch (error) {
        return rawValue.replace(/\/$/, "");
    }
}

export function hasSupabaseConfig() {
    return Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);
}

export function publicSupabaseConfig() {
    return {
        url: normalizeSupabaseUrl(SUPABASE_URL),
        anonKey: SUPABASE_PUBLIC_KEY
    };
}

export function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

export async function supabaseRequest(path, options = {}) {
    if (!hasSupabaseConfig()) {
        throw new Error("Supabase environment variables are missing.");
    }

    const baseUrl = normalizeSupabaseUrl(SUPABASE_URL);
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_SERVER_KEY,
            Authorization: `Bearer ${SUPABASE_SERVER_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation,resolution=merge-duplicates",
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
        throw new Error(data?.message || data?.hint || "Supabase request failed.");
    }

    return data;
}

export async function verifySupabaseUser(token) {
    if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY || !token) return null;

    const baseUrl = normalizeSupabaseUrl(SUPABASE_URL);
    const response = await fetch(`${baseUrl}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) return null;
    return response.json();
}

export function isAdminEmail(email) {
    const adminEmails = String(process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

    return adminEmails.includes(String(email || "").toLowerCase());
}
