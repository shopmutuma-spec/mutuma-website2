export function showPageError() {
    if (document.querySelector("[data-page-error]")) return;
    const section = document.createElement("section");
    section.className = "page-error";
    section.dataset.pageError = "";
    section.setAttribute("role", "alert");
    section.innerHTML = '<h2>This page could not finish loading.</h2><p>Please try loading the page again.</p><button type="button" class="button secondary">Try again</button>';
    section.querySelector("button").addEventListener("click", () => location.reload());
    document.querySelector("main")?.prepend(section);
}
