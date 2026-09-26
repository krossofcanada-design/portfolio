export function initMenu() {
    const toggle = document.querySelector(".menu_toggle");
    const menu = document.querySelector("#main-menu");
    const projectsToggle = document.querySelector(".projects-toggle");
    const projectLinks = document.querySelector("#project-links");

    if (!toggle || !menu || !projectsToggle || !projectLinks) return;

    function setMenuOpen(open) {
        menu.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");

    if (open) {
        projectsToggle.setAttribute("aria-expanded", "false");
        projectLinks.hidden = true;
    }
    }

    toggle.addEventListener("click", () => {
        setMenuOpen(menu.hidden);
    });

    projectsToggle.addEventListener("click", () => {
        const expanded =
            projectsToggle.getAttribute("aria-expanded") === "true";

        projectsToggle.setAttribute("aria-expanded", String(!expanded));
        projectLinks.hidden = expanded;
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !menu.hidden) {
            setMenuOpen(false);
            toggle.focus();
        }
    });
}