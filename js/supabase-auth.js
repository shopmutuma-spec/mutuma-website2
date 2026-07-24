const SESSION_KEY = "mutuma.supabaseSession";

let configPromise;

async function loadConfig() {
    if (!configPromise) {
        configPromise = fetch("/.netlify/functions/supabase-config")
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || "Supabase is not configured yet.");
                return data;
            });
    }

    return configPromise;
}

function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
        return null;
    }
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

async function authRequest(path, body) {
    const config = await loadConfig();
    const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/${path}`, {
        method: "POST",
        headers: {
            apikey: config.anonKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error_description || data.msg || data.message || "Account request failed.");
    }

    return data;
}

export async function signUp(email, password) {
    const data = await authRequest("signup", { email, password });
    if (data.access_token) saveSession(data);
    return data;
}

export async function signIn(email, password) {
    const data = await authRequest("token?grant_type=password", { email, password });
    saveSession(data);
    return data;
}

export async function getCurrentUser() {
    const session = getSession();
    if (!session?.access_token) return null;

    const config = await loadConfig();
    const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/user`, {
        headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${session.access_token}`
        }
    });

    if (!response.ok) {
        clearSession();
        return null;
    }

    return response.json();
}

export async function adminFetch(path) {
    const session = getSession();
    if (!session?.access_token) throw new Error("Please sign in first.");

    const response = await fetch(path, {
        headers: {
            Authorization: `Bearer ${session.access_token}`
        }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(data.error || "Admin request failed.");
    return data;
}
