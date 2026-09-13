import { safeImageUrl } from "./html.js";

export function productSeo(product) {
    if (!product) return null;
    const url = `https://mutumas.com/product?id=${encodeURIComponent(product.id)}`;
    return {
        title: `${product.name} | MUTUMA`,
        description: String(product.description || `Shop ${product.name} at MUTUMA.`).slice(0, 160),
        url,
        image: new URL(safeImageUrl(product.images?.[0]), "https://mutumas.com/").href
    };
}

export function updateProductSeo(product) {
    const seo = productSeo(product);
    const meta = (attribute, name, content) => {
        let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
        if (!element) { element = document.createElement("meta"); element.setAttribute(attribute, name); document.head.append(element); }
        element.content = content;
    };
    if (!seo) { meta("name", "robots", "noindex, follow"); return; }
    document.title = seo.title;
    meta("name", "description", seo.description);
    meta("property", "og:title", seo.title);
    meta("property", "og:description", seo.description);
    meta("property", "og:image", seo.image);
    meta("property", "og:url", seo.url);
    meta("property", "og:type", "product");
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
    canonical.href = seo.url;
    let schema = document.querySelector("#product-schema");
    if (!schema) { schema = document.createElement("script"); schema.type = "application/ld+json"; schema.id = "product-schema"; document.head.append(schema); }
    schema.textContent = JSON.stringify({
        "@context": "https://schema.org", "@type": "Product", name: product.name,
        description: product.description, image: seo.image, sku: product.sku || product.id,
        offers: { "@type": "Offer", url: seo.url, priceCurrency: product.currency || "USD", price: product.price,
            availability: product.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" }
    });
}
