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

function oauthRedirectUrl() {
    const url = new URL("account.html", window.location.origin);
    return url.toString();
}

function authUrlParams() {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    return { hashParams, searchParams };
}

function firstAuthValue(key) {
    const { hashParams, searchParams } = authUrlParams();
    return hashParams.get(key) || searchParams.get(key);
}

function sessionFromUrl() {
    const accessToken = firstAuthValue("access_token");
    if (!accessToken) return null;

    return {
        access_token: accessToken,
        refresh_token: firstAuthValue("refresh_token"),
        expires_in: Number(firstAuthValue("expires_in") || 0),
        expires_at: firstAuthValue("expires_at") ? Number(firstAuthValue("expires_at")) : null,
        token_type: firstAuthValue("token_type") || "bearer",
        provider_token: firstAuthValue("provider_token")
    };
}

function oauthErrorFromUrl() {
    const { hashParams, searchParams } = authUrlParams();
    return hashParams.get("error_description")
        || hashParams.get("error")
        || searchParams.get("error_description")
        || searchParams.get("error");
}

function oauthCodeFromUrl() {
    return firstAuthValue("code");
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

export function completeOAuthRedirect() {
    const error = oauthErrorFromUrl();
    if (error) {
        window.history.replaceState({}, document.title, window.location.pathname);
        throw new Error(error);
    }

    const session = sessionFromUrl();
    if (!session) {
        if (oauthCodeFromUrl()) {
            window.history.replaceState({}, document.title, window.location.pathname);
            throw new Error("Google returned an auth code but not a login session. Check Supabase redirect settings, then try again.");
        }

        return null;
    }

    saveSession(session);
    window.history.replaceState({}, document.title, window.location.pathname);
    return session;
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

export async function signInWithGoogle() {
    const config = await loadConfig();
    const url = new URL(`${config.url.replace(/\/$/, "")}/auth/v1/authorize`);
    url.searchParams.set("provider", "google");
    url.searchParams.set("redirect_to", oauthRedirectUrl());
    window.location.assign(url.toString());
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

export async function adminFetch(path, options = {}) {
    const session = getSession();
    if (!session?.access_token) throw new Error("Please sign in first.");

    const response = await fetch(path, {
        ...options,
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(data.error || "Admin request failed.");
    return data;
}
