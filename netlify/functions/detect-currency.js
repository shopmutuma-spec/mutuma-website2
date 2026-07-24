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

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        },
        body: JSON.stringify(body)
    };
}

function normalizeCountry(country) {
    const code = String(country || "").trim().toUpperCase();
    return code.length === 2 ? code : "";
}

function countryToCurrency(countryCode) {
    const country = normalizeCountry(countryCode);
    if (euroCountries.includes(country)) return "EUR";
    return countryCurrencyMap[country] || "GBP";
}

function header(event, name) {
    return event.headers[name] || event.headers[name.toLowerCase()] || event.headers[name.toUpperCase()] || "";
}

function headerCountry(event) {
    const directHeaders = [
        "x-country-code",
        "x-nf-country",
        "x-vercel-ip-country",
        "cf-ipcountry",
        "cloudfront-viewer-country",
        "fastly-client-country",
        "x-appengine-country"
    ];

    for (const name of directHeaders) {
        const country = normalizeCountry(header(event, name));
        if (country && country !== "XX") return country;
    }

    const geoHeader = header(event, "x-nf-geo");
    if (geoHeader) {
        try {
            const geo = JSON.parse(geoHeader);
            const country = normalizeCountry(geo.country?.code || geo.country_code || geo.country);
            if (country) return country;
        } catch (error) {
            return "";
        }
    }

    return "";
}

function languageCountry(event) {
    const acceptLanguage = header(event, "accept-language");
    const languages = acceptLanguage.split(",").map((item) => item.trim().split(";")[0]);

    for (const language of languages) {
        const region = language.toUpperCase().replace("_", "-").split("-").pop();
        const country = normalizeCountry(region);
        if (country) return country;
    }

    return "";
}

function contextCountry(context) {
    return normalizeCountry(
        context?.geo?.country?.code ||
        context?.geo?.country_code ||
        context?.geo?.country
    );
}

export async function handler(event, context) {
    const country = contextCountry(context) || headerCountry(event) || languageCountry(event);
    const currency = countryToCurrency(country);

    return json(200, {
        country: country || "",
        currency,
        source: country ? "server" : "fallback"
    });
}
