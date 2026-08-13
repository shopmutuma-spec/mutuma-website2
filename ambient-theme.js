(function () {
    var root = document.documentElement;
    var body = document.body;
    var hour = new Date().getHours();
    var theme = hour >= 6 && hour < 18 ? "day" : "night";

    root.classList.remove("theme-day", "theme-night");
    root.classList.add("theme-" + theme);

    if (body) {
        body.dataset.ambientTheme = theme;
    }
}());
