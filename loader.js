const loader = document.querySelector("[data-loader]");

document.documentElement.classList.remove("no-js");

if (loader) {
    if (sessionStorage.getItem("mutuma.loaderSeen") === "true") {
        loader.remove();
    } else {
        sessionStorage.setItem("mutuma.loaderSeen", "true");

        window.setTimeout(() => {
            document.body.classList.add("loading-complete");
            loader.classList.add("loaded");
        }, 480);

        window.setTimeout(() => {
            loader.remove();
        }, 720);
    }
}
