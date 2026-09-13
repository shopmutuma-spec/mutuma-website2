export function bindProductPurchase({ root, product, enabled, add, checkout, notify, onCheckoutStarted, lifecycle = window }) {
    const input = root.querySelector("[data-quantity]");
    const minus = root.querySelector("[data-qty-minus]");
    const plus = root.querySelector("[data-qty-plus]");
    const addButtons = [...root.querySelectorAll("[data-add-product], [data-mobile-add]")];
    const buyButtons = [...root.querySelectorAll("[data-buy-stripe], [data-mobile-buy]")];
    const labels = buyButtons.map((button) => button.textContent);
    const stock = product.stock == null ? 20 : Number(product.stock);
    const maximum = Number.isFinite(stock) ? Math.max(0, Math.min(20, Math.floor(stock))) : 20;
    let opening = false;

    input.type = "number";
    input.min = "1";
    input.max = String(maximum || 1);
    input.step = "1";
    input.disabled = maximum === 0;

    function refresh() {
        const quantity = Number(input.value);
        minus.disabled = maximum === 0 || quantity <= 1;
        plus.disabled = maximum === 0 || quantity >= maximum;
        addButtons.forEach((button) => { button.disabled = maximum === 0; });
        buyButtons.forEach((button, index) => {
            button.disabled = !enabled || maximum === 0 || opening;
            button.textContent = opening ? (button.hasAttribute("data-mobile-buy") ? "Opening..." : "Opening checkout...") : labels[index];
            button.setAttribute("aria-busy", String(opening));
        });
    }

    function readQuantity() {
        const value = Number(input.value);
        if (maximum === 0 || !input.value.trim() || !Number.isInteger(value) || value < 1 || value > maximum) {
            input.setCustomValidity(maximum === 0 ? "This product is out of stock." : `Choose a whole quantity from 1 to ${maximum}.`);
            input.reportValidity();
            return null;
        }
        input.setCustomValidity("");
        return value;
    }

    input.addEventListener("input", () => { input.setCustomValidity(""); refresh(); });
    input.addEventListener("change", () => { readQuantity(); refresh(); });
    [[minus, -1], [plus, 1]].forEach(([button, step]) => {
        button.addEventListener("click", () => {
            const quantity = readQuantity();
            if (quantity === null) return;
            input.value = String(Math.max(1, Math.min(maximum, quantity + step)));
            refresh();
        });
    });
    addButtons.forEach((button) => button.addEventListener("click", () => {
        const quantity = readQuantity();
        if (quantity !== null) add(product.id, quantity);
    }));
    buyButtons.forEach((button) => button.addEventListener("click", async () => {
        if (opening || !enabled) return;
        const quantity = readQuantity();
        if (quantity === null) return;
        opening = true;
        refresh();
        try {
            // Optional measurement must never prevent the checkout request.
            try { onCheckoutStarted?.(button.hasAttribute("data-mobile-buy") ? "mobile_sticky" : "product_page"); } catch {}
            const result = await checkout(product.id, quantity);
            if (result?.ok) return;
            opening = false;
            notify(result?.message || "Checkout could not open. Please try again.");
        } catch {
            opening = false;
            notify("Checkout could not open. Please try again.");
        } finally {
            refresh();
        }
    }));
    lifecycle.addEventListener("pageshow", (event) => {
        if (event.persisted) { opening = false; refresh(); }
    });
    refresh();
}
