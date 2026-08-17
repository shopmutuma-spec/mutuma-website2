const CURRENCY_KEY = "mutuma.currency";
const RATES_KEY = "mutuma.exchangeRates.usd.v1";
const GEO_KEY = "mutuma.location";
const GEO_VERSION = 8;
const RATE_TTL = 1000 * 60 * 60 * 6;
const GEO_TTL = 1000 * 60 * 15;
const BASE_CURRENCY = "USD";

const fallbackRates = {
    USD: 1,
    GBP: 0.79,
    EUR: 0.93,
    CAD: 1.36,
    AUD: 1.51,
    NZD: 1.64,
    JPY: 160,
    CHF: 0.9,
    CNY: 7.26,
    HKD: 7.83,
    SGD: 1.35,
    INR: 83.62,
    AED: 3.67,
    SAR: 3.75,
    ZAR: 18.19,
    SEK: 10.51,
    NOK: 10.57,
    DKK: 6.93,
    PLN: 3.96,
    MXN: 18.03,
    BRL: 5.55,
    KRW: 1386,
    THB: 36.46,
    TRY: 33.15,
    ILS: 3.75,
    CZK: 23.15,
    HUF: 364.57,
    RON: 4.62,
    BGN: 1.82,
    ISK: 138.58,
    IDR: 16299,
    MYR: 4.71,
    PHP: 58.5
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
    currency: normalizeCurrency(safeGet(CURRENCY_KEY)) || BASE_CURRENCY,
    rates: fallbackRates
};

let currencyInitPromise = null;
let currencyInitialized = false;

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
    return BASE_CURRENCY;
}

function localeCountry() {
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language || "en-US"];

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

    return "US";
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

    return "US";
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

    try {
        return [await Promise.any(fallbackServices.map(runService))];
    } catch (error) {
        return [];
    }
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
        country: "US",
        currency: normalizeCurrency(countryToCurrency(browserCountry())) || getStoredCurrency() || BASE_CURRENCY,
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
        const data = await fetchJson(`https://api.frankfurter.app/latest?from=${BASE_CURRENCY}`);
        const rates = { ...fallbackRates, [BASE_CURRENCY]: 1, ...data.rates };
        safeSet(RATES_KEY, JSON.stringify({ time: Date.now(), rates }));
        return rates;
    } catch (error) {
        return fallbackRates;
    }
}

export async function initCurrency() {
    if (currencyInitialized) return currencyState;
    if (currencyInitPromise) return currencyInitPromise;

    currencyInitPromise = (async () => {
        const [currency, rates] = await Promise.all([
            detectCurrency().catch(() => countryToCurrency(browserCountry()) || getStoredCurrency() || BASE_CURRENCY),
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
                currencyInitialized = false;
                currencyInitPromise = null;
                await initCurrency();
                return currentCurrency();
            }
        };
        currencyInitialized = true;
        window.dispatchEvent(new CustomEvent("currencychange", { detail: currencyState }));
        return currencyState;
    })().finally(() => {
        currencyInitPromise = null;
    });

    return currencyInitPromise;
}

export async function readyCurrency(timeout = 1600) {
    if (currencyInitialized) return currentCurrency();

    const waitForCurrency = currencyInitPromise || initCurrency();

    try {
        await Promise.race([
            waitForCurrency,
            new Promise((resolve) => window.setTimeout(resolve, timeout))
        ]);
    } catch (error) {
        return currentCurrency();
    }

    return currentCurrency();
}

export function currentCurrency() {
    return currencyState.currency;
}

export function convertPrice(baseAmount) {
    return baseAmount * (currencyState.rates[currencyState.currency] || fallbackRates[currencyState.currency] || 1);
}

export function formatPrice(baseAmount) {
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currencyState.currency,
            maximumFractionDigits: ["JPY", "KRW"].includes(currencyState.currency) ? 0 : 2
        }).format(convertPrice(baseAmount));
    } catch (error) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: BASE_CURRENCY
        }).format(baseAmount);
    }
}
