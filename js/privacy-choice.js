const KEY = "mutuma.analyticsConsent.v1";
let choice;
try { choice = localStorage.getItem(KEY); } catch { /* Consent remains unset. */ }

export function analyticsAllowed() { return choice === "accepted"; }

export function setAnalyticsChoice(value) {
    choice = value === "accepted" ? "accepted" : "rejected";
    try {
        localStorage.setItem(KEY, choice);
    } catch { /* The in-memory choice still applies to this page. */ }
    if (!analyticsAllowed()) {
        for (const key of ["mutuma.analyticsSession", "mutuma.firstTouch", "mutuma.lastTouch"]) {
            try { localStorage.removeItem(key); } catch { /* Storage may be blocked. */ }
        }
        try { sessionStorage.removeItem("mutuma.analyticsSessionStarted"); } catch { /* Storage may be blocked. */ }
    }
    window.dispatchEvent(new Event("mutuma:privacychange"));
}

export function showPrivacyChoice() {
    if (document.querySelector("[data-privacy-choice]")) return;
    const panel = document.createElement("section");
    panel.className = "privacy-choice";
    panel.dataset.privacyChoice = "";
    panel.setAttribute("aria-label", "Analytics preferences");
    panel.innerHTML = '<p>Allow optional analytics to help us improve the store? Shopping works without it. <a href="privacy.html">Privacy policy</a></p><div><button type="button" class="button secondary" data-choice="rejected">Reject analytics</button><button type="button" class="button secondary" data-choice="accepted">Allow analytics</button></div>';
    panel.addEventListener("click", (event) => {
        const button = event.target.closest("[data-choice]");
        if (!button) return;
        setAnalyticsChoice(button.dataset.choice);
        const restoreFocus = panel.contains(document.activeElement);
        panel.remove();
        if (restoreFocus) document.querySelector("[data-privacy-settings]")?.focus();
    });
    document.body.append(panel);
}

export function initPrivacyChoice() {
    document.querySelector("[data-privacy-settings]")?.addEventListener("click", showPrivacyChoice);
    if (!["accepted", "rejected"].includes(choice)) showPrivacyChoice();
}
