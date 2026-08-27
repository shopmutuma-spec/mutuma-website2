import { initCurrency } from "./currency.js?v=20260827a";
import { getCart, getWishlist } from "./store.js?v=20260827a";
import { initBaseLayout, notify } from "./ui.js?v=20260827a";
import { clearSession, completeOAuthRedirect, getCurrentUser, signIn, signInWithGoogle, signUp } from "./supabase-auth.js?v=20260827a";

initBaseLayout();
initCurrency().catch(() => {});

const form = document.querySelector("[data-auth-form]");
const message = document.querySelector("[data-auth-message]");
const panel = document.querySelector("[data-account-panel]");
const googleButton = document.querySelector("[data-google-sign-in]");

try {
    const oauthSession = completeOAuthRedirect();
    if (oauthSession) {
        message.textContent = "You're signed in with Google.";
    }
} catch (error) {
    message.textContent = error.message;
}

async function renderAccount() {
    const user = await getCurrentUser().catch(() => null);

    if (!user) {
        panel.innerHTML = `
            <h2>Your MUTUMA space</h2>
            <p>Sign in to connect your email with future account features. Wishlist and cart still work on this device without an account.</p>
        `;
        return;
    }

    panel.innerHTML = `
        <h2>Signed in</h2>
        <p>${user.email}</p>
        <div class="account-stats">
            <span><strong>${getWishlist().length}</strong> saved products</span>
            <span><strong>${getCart().reduce((total, item) => total + item.quantity, 0)}</strong> cart items</span>
        </div>
        <div class="split-actions">
            <a class="button secondary" href="wishlist.html">View Wishlist</a>
            <a class="button secondary" href="cart.html">View Cart</a>
        </div>
        <button class="button primary" data-sign-out>Sign Out</button>
    `;

    panel.querySelector("[data-sign-out]").addEventListener("click", () => {
        clearSession();
        notify("Signed out");
        renderAccount();
    });
}

async function handleAuth(mode) {
    const email = form.email.value.trim();
    const password = form.password.value;
    const button = mode === "signup" ? form.querySelector("[data-sign-up]") : form.querySelector("[data-sign-in]");
    button.disabled = true;
    message.textContent = mode === "signup" ? "Creating account..." : "Signing in...";

    try {
        const result = mode === "signup" ? await signUp(email, password) : await signIn(email, password);
        message.textContent = result.access_token
            ? "You're signed in."
            : "Account created. Check your email if confirmation is enabled in Supabase.";
        await renderAccount();
    } catch (error) {
        message.textContent = error.message;
    } finally {
        button.disabled = false;
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuth("signin");
});

form.querySelector("[data-sign-up]").addEventListener("click", () => {
    handleAuth("signup");
});

googleButton?.addEventListener("click", async () => {
    googleButton.disabled = true;
    message.textContent = "Opening Google...";

    try {
        await signInWithGoogle();
    } catch (error) {
        message.textContent = error.message;
        googleButton.disabled = false;
    }
});

renderAccount();
