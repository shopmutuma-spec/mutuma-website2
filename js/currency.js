const CURRENCY_KEY = "mutuma.currency";
const RATES_KEY = "mutuma.exchangeRates";
const GEO_KEY = "mutuma.location";
const GEO_VERSION = 7;
const RATE_TTL = 1000 * 60 * 60 * 6;
const GEO_TTL = 1000 * 60 * 15;

const fallbackRates = {
    GBP: 1,
    USD: 1.27,
    EUR: 1.18,
    CAD: 1.73,
    AUD: 1.92,
    NZD: 2.08,
    JPY: 203,
    CHF: 1.14,
    CNY: 9.22,
    HKD: 9.94,
    SGD: 1.71,
    INR: 106.2,
    AED: 4.66,
    SAR: 4.76,
    ZAR: 23.1,
    SEK: 13.35,
    NOK: 13.42,
    DKK: 8.8,
    PLN: 5.03,
    MXN: 22.9,
    BRL: 7.05,
    KRW: 1760,
    THB: 46.3,
    TRY: 42.1,
    ILS: 4.76,
    CZK: 29.4,
    HUF: 463,
    RON: 5.87,
    BGN: 2.31,
    ISK: 176,
    IDR: 20700,
    MYR: 5.98,
    PHP: 74.3
};

const europeanUnion = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
const euroCountries = [...europeanUnion, "AD", "MC", "SM", "VA", "ME", "XK"];
const supportedCurrencies = new Set([
    "GBP", "USD", "EUR", "CAD", "AUD", "NZD", "JPY", "CHF", "CNY", "HKD",
    "SGD", "INR", "AED", "SAR", "ZAR", "SEK", "NOK", "DKK", "PLN", "MXN",
    "BRL", "KRW", "THB", "TRY", "ILS", "CZK", "HUF", "RON", "BGN", "ISK",
    "IDR", "MYR", "PHP"
]);

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
    QA: "AED",
    RO: "RON",
    SA: "SAR",
    SE: "SEK",
    SG: "SGD",
    TH: "THB",
    TR: "TRY",
    US: "USD",
    ZA: "ZAR"
};

const timeZoneCountryMap = {
    "America/Adak": "US",
    "America/Anchorage": "US",
    "America/Boise": "US",
    "America/Chicago": "US",
    "America/Denver": "US",
    "America/Detroit": "US",
    "America/Indiana/Indianapolis": "US",
    "America/Indiana/Knox": "US",
    "America/Indiana/Marengo": "US",
    "America/Indiana/Petersburg": "US",
    "America/Indiana/Tell_City": "US",
    "America/Indiana/Vevay": "US",
    "America/Indiana/Vincennes": "US",
    "America/Indiana/Winamac": "US",
    "America/Juneau": "US",
    "America/Kentucky/Louisville": "US",
    "America/Kentucky/Monticello": "US",
    "America/Los_Angeles": "US",
    "America/Menominee": "US",
    "America/Metlakatla": "US",
    "America/New_York": "US",
    "America/Nome": "US",
    "America/North_Dakota/Beulah": "US",
    "America/North_Dakota/Center": "US",
    "America/North_Dakota/New_Salem": "US",
    "America/Phoenix": "US",
    "America/Puerto_Rico": "US",
    "America/Sitka": "US",
    "America/Yakutat": "US",
    "Pacific/Honolulu": "US",
    "America/Toronto": "CA",
    "America/Vancouver": "CA",
    "America/Edmonton": "CA",
    "America/Winnipeg": "CA",
    "America/Halifax": "CA",
    "America/St_Johns": "CA",
    "Europe/London": "GB",
    "Europe/Dublin": "IE",
    "Europe/Paris": "FR",
    "Europe/Berlin": "DE",
    "Europe/Madrid": "ES",
    "Europe/Rome": "IT",
    "Europe/Amsterdam": "NL",
    "Australia/Sydney": "AU",
    "Australia/Melbourne": "AU",
    "Australia/Brisbane": "AU",
    "Australia/Perth": "AU",
    "Pacific/Auckland": "NZ",
    "Asia/Tokyo": "JP",
    "Asia/Dubai": "AE",
    "Asia/Singapore": "SG",
    "Asia/Hong_Kong": "HK",
    "Asia/Shanghai": "CN",
    "Asia/Kolkata": "IN",
    "Asia/Seoul": "KR",
    "Asia/Bangkok": "TH",
    "Asia/Kuala_Lumpur": "MY",
    "Asia/Manila": "PH",
    "Asia/Jerusalem": "IL",
    "Africa/Johannesburg": "ZA"
};

let currencyState = {
    currency: normalizeCurrency(safeGet(CURRENCY_KEY)) || "GBP",
    rates: fallbackRates
};

function safeGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function safeSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        return false;
    }

    return true;
}

function safeJsonGet(key) {
    try {
        return JSON.parse(safeGet(key) || "null");
    } catch (error) {
        return null;
    }
}

async function fetchJson(url, timeout = 2400) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Location request failed: ${response.status}`);
        }

        return await response.json();
    } finally {
        window.clearTimeout(timeoutId);
    }
}

async function fetchText(url, timeout = 2400) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Location request failed: ${response.status}`);
        }

        return await response.text();
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function countryToCurrency(countryCode) {
    const country = String(countryCode || "").toUpperCase();
    if (euroCountries.includes(country)) return "EUR";
    if (countryCurrencyMap[country]) return countryCurrencyMap[country];
    return "GBP";
}

function localeCountry() {
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language || "en-GB"];

    for (const locale of locales) {
        try {
            const region = new Intl.Locale(locale).region;
            if (region) return region.toUpperCase();
        } catch (error) {
            const parts = String(locale).toUpperCase().replace("_", "-").split("-");
            const region = parts.length > 1 ? parts.pop() : "";
            if (region && region.length === 2) return region;
        }
    }

    return "GB";
}

function timeZoneCountry() {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return normalizeCountry(timeZoneCountryMap[timeZone]);
    } catch (error) {
        return "";
    }
}

function browserCountry() {
    const zoneCountry = timeZoneCountry();
    const languageCountry = localeCountry();

    if (zoneCountry) return zoneCountry;
    if (languageCountry) return languageCountry;

    return "GB";
}

function normalizeCurrency(currency) {
    const code = String(currency || "").toUpperCase();
    return supportedCurrencies.has(code) ? code : "";
}

function normalizeCountry(country) {
    const code = String(country || "").toUpperCase();
    return code.length === 2 ? code : "";
}

function getStoredCurrency() {
    return normalizeCurrency(safeGet(CURRENCY_KEY));
}

function signalFromCountry(country, source, priority) {
    const normalizedCountry = normalizeCountry(country);
    const currency = countryToCurrency(normalizedCountry);

    return {
        country: normalizedCountry,
        currency: normalizeCurrency(currency),
        source,
        priority
    };
}

function browserSignals() {
    const signals = [];
    const zoneCountry = timeZoneCountry();
    const locale = localeCountry();

    if (zoneCountry) {
        signals.push(signalFromCountry(zoneCountry, "timezone", 70));
    }

    if (locale) {
        signals.push(signalFromCountry(locale, "locale", 45));
    }

    return signals.filter((signal) => signal.country && signal.currency);
}

function parseCloudflareTrace(text) {
    const lines = String(text || "").split("\n");
    const lookup = Object.fromEntries(lines.map((line) => line.split("=")).filter((parts) => parts.length === 2));

    return {
        country: normalizeCountry(lookup.loc),
        currency: ""
    };
}

async function detectFromServices() {
    const primaryServices = [
        {
            url: "/currency-location",
            priority: 140,
            parse: (data) => ({
                country: normalizeCountry(data.country),
                currency: normalizeCurrency(data.currency)
            })
        },
        {
            url: "/.netlify/functions/detect-currency",
            priority: 120,
            parse: (data) => ({
                country: normalizeCountry(data.country),
                currency: normalizeCurrency(data.currency)
            })
        }
    ];

    const fallbackServices = [
        {
            url: "https://ipapi.co/json/",
            priority: 105,
            parse: (data) => ({
                country: normalizeCountry(data.country_code || data.country),
                currency: normalizeCurrency(data.currency)
            })
        },
        {
            url: "https://ipwho.is/",
            priority: 100,
            parse: (data) => ({
                country: normalizeCountry(data.country_code),
                currency: normalizeCurrency(data.currency?.code)
            })
        },
        {
            url: "https://ipinfo.io/json",
            priority: 95,
            parse: (data) => ({
                country: normalizeCountry(data.country),
                currency: ""
            })
        },
        {
            url: "https://get.geojs.io/v1/ip/country.json",
            priority: 90,
            parse: (data) => ({
                country: normalizeCountry(data.country),
                currency: ""
            })
        },
        {
            url: "https://api.country.is/",
            priority: 85,
            parse: (data) => ({
                country: normalizeCountry(data.country),
                currency: ""
            })
        }
    ];

    const runService = async (service) => {
        const data = await fetchJson(service.url);
        const result = service.parse(data);
        const country = normalizeCountry(result.country);
        const currency = normalizeCurrency(result.currency || countryToCurrency(country));

        if (!country || !currency) {
            throw new Error("Currency service returned incomplete location data.");
        }

        return {
            country,
            currency,
            source: service.url,
            priority: service.priority
        };
    };

    for (const service of primaryServices) {
        try {
            return [await runService(service)];
        } catch (error) {
            continue;
        }
    }

    for (const service of fallbackServices) {
        try {
            return [await runService(service)];
        } catch (error) {
            continue;
        }
    }

    return [];
}

async function detectFromTextServices() {
    const service = {
        url: "https://www.cloudflare.com/cdn-cgi/trace",
        priority: 92,
        parse: parseCloudflareTrace
    };

    try {
        const text = await fetchText(service.url);
        const result = service.parse(text);
        const country = normalizeCountry(result.country);
        const currency = normalizeCurrency(result.currency || countryToCurrency(country));

        if (!country || !currency) {
            throw new Error("Currency text service returned incomplete location data.");
        }

        return {
            country,
            currency,
            source: service.url,
            priority: service.priority
        };
    } catch (error) {
        return null;
    }
}

function bestSignal(signals) {
    const validSignals = signals.filter((signal) => signal.country && signal.currency);

    return validSignals.sort((first, second) => second.priority - first.priority)[0] || {
        country: "GB",
        currency: normalizeCurrency(countryToCurrency(browserCountry())) || getStoredCurrency() || "GBP",
        source: "fallback",
        priority: 0
    };
}

async function detectCurrency() {
    const cached = safeJsonGet(GEO_KEY);
    const cachedCountry = normalizeCountry(cached?.country);
    const cachedCurrency = normalizeCurrency(cached?.currency);

    if (cached && cached.version === GEO_VERSION && cached.source !== "fallback" && Date.now() - cached.time < GEO_TTL && cachedCountry && cachedCurrency) {
        return cached.currency;
    }

    const serviceSignals = await detectFromServices();
    const textSignal = serviceSignals.length ? null : await detectFromTextServices();
    const textSignals = textSignal ? [textSignal] : [];
    const localSignals = browserSignals();
    const signal = bestSignal([...serviceSignals, ...textSignals, ...localSignals]);
    const { country, currency } = signal;

    window.MUTUMACurrencyDebug = {
        chosen: signal,
        signals: [...serviceSignals, ...textSignals, ...localSignals],
        stored: {
            currency: getStoredCurrency(),
            location: cached || null
        },
        version: GEO_VERSION
    };

    safeSet(GEO_KEY, JSON.stringify({ version: GEO_VERSION, time: Date.now(), country, currency, source: signal.source }));
    safeSet(CURRENCY_KEY, currency);
    return currency;
}

async function loadRates() {
    const cached = safeJsonGet(RATES_KEY);
    if (cached && Date.now() - cached.time < RATE_TTL) {
        return cached.rates;
    }

    try {
        const data = await fetchJson("https://api.frankfurter.app/latest?from=GBP");
        const rates = { ...fallbackRates, GBP: 1, ...data.rates };
        safeSet(RATES_KEY, JSON.stringify({ time: Date.now(), rates }));
        return rates;
    } catch (error) {
        return fallbackRates;
    }
}

export async function initCurrency() {
    const [currency, rates] = await Promise.all([
        detectCurrency().catch(() => countryToCurrency(browserCountry()) || getStoredCurrency() || "GBP"),
        loadRates().catch(() => fallbackRates)
    ]);
    currencyState = { currency, rates };
    window.MUTUMACurrency = {
        currency,
        rates,
        country: safeJsonGet(GEO_KEY)?.country || "",
        debug: () => window.MUTUMACurrencyDebug,
        refresh: async () => {
            safeSet(GEO_KEY, "");
            safeSet(CURRENCY_KEY, "");
            await initCurrency();
            return currentCurrency();
        }
    };
    window.dispatchEvent(new CustomEvent("currencychange", { detail: currencyState }));
}

export function currentCurrency() {
    return currencyState.currency;
}

export function convertPrice(gbpAmount) {
    return gbpAmount * (currencyState.rates[currencyState.currency] || fallbackRates[currencyState.currency] || 1);
}

export function formatPrice(gbpAmount) {
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currencyState.currency,
            maximumFractionDigits: ["JPY", "KRW"].includes(currencyState.currency) ? 0 : 2
        }).format(convertPrice(gbpAmount));
    } catch (error) {
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP"
        }).format(gbpAmount);
    }
}
