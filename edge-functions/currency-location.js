const europeanUnion = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
const euroCountries = [...europeanUnion, "AD", "MC", "SM", "VA", "ME", "XK"];

const countryCurrencyMap = {
    AE: "AED",
    AU: "AUD",
    BR: "BRL",
    CA: "CAD",
    CH: "CHF",
    CN: "CNY",
    CZ: "CZK",
    DK: "DKK",
    GB: "GBP",
    HK: "HKD",
    HU: "HUF",
    ID: "IDR",
    IL: "ILS",
    IN: "INR",
    IS: "ISK",
    JP: "JPY",
    KR: "KRW",
    MX: "MXN",
    MY: "MYR",
    NO: "NOK",
    NZ: "NZD",
    PH: "PHP",
    PL: "PLN",
    RO: "RON",
    SA: "SAR",
    SE: "SEK",
    SG: "SGD",
    TH: "THB",
    TR: "TRY",
    US: "USD",
    ZA: "ZAR"
};

function normalizeCountry(country) {
    const code = String(country || "").trim().toUpperCase();
    return code.length === 2 ? code : "";
}

function countryToCurrency(countryCode) {
    const country = normalizeCountry(countryCode);
    if (euroCountries.includes(country)) return "EUR";
    return countryCurrencyMap[country] || "GBP";
}

function geoCountry(context) {
    return normalizeCountry(
        context.geo?.country?.code ||
        context.geo?.countryCode ||
        context.geo?.country
    );
}

function headerCountry(request) {
    const headers = [
        "x-country-code",
        "x-nf-country",
        "x-vercel-ip-country",
        "cf-ipcountry",
        "cloudfront-viewer-country",
        "fastly-client-country",
        "x-appengine-country"
    ];

    for (const header of headers) {
        const country = normalizeCountry(request.headers.get(header));
        if (country && country !== "XX") return country;
    }

    return "";
}

function languageCountry(request) {
    const acceptLanguage = request.headers.get("accept-language") || "";
    const languages = acceptLanguage.split(",").map((item) => item.trim().split(";")[0]);

    for (const language of languages) {
        const region = language.toUpperCase().replace("_", "-").split("-").pop();
        const country = normalizeCountry(region);
        if (country) return country;
    }

    return "";
}

export default async (request, context) => {
    const country = geoCountry(context) || headerCountry(request) || languageCountry(request);
    const currency = countryToCurrency(country);

    return Response.json({
        country,
        currency,
        source: country ? "netlify-edge" : "fallback"
    }, {
        headers: {
            "Cache-Control": "no-store"
        }
    });
};
