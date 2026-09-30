// Set up the main menu and its expandable Projects section.
export function initMenu() {
    const toggle = document.querySelector(".menu_toggle");
    const menu = document.querySelector("#main-menu");
    const projectsToggle = document.querySelector(".projects-toggle");
    const projectLinks = document.querySelector("#project-links");

    if (!toggle || !menu || !projectsToggle || !projectLinks) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map();
    let menuOpen = false;
    let projectsOpen = false;

    toggle.setAttribute("aria-controls", menu.id);

    // Measure the current frame before cancelling so rapid clicks reverse
    // from the visible position instead of jumping to an endpoint.
    function animateVisibility(element, open, expand = false) {
        const wasHidden = element.hidden;
        const style = getComputedStyle(element);
        const current = {
            opacity: style.opacity,
            transform: style.transform,
        };
        if (expand) {
            current.height = `${element.getBoundingClientRect().height}px`;
            current.paddingBottom = style.paddingBottom;
            current.marginBottom = style.marginBottom;
        }

        animations.get(element)?.cancel();
        animations.delete(element);
        element.hidden = false;
        element.inert = !open;

        const natural = getComputedStyle(element);
        const shown = { opacity: 1, transform: "translateY(0)" };
        const concealed = { opacity: 0, transform: "translateY(-0.75rem)" };
        if (expand) {
            shown.height = `${element.getBoundingClientRect().height}px`;
            shown.paddingBottom = natural.paddingBottom;
            shown.marginBottom = "0px";
            concealed.height = "0px";
            concealed.paddingBottom = "0px";
            // Remove the extra flex gap gradually as the section collapses.
            concealed.marginBottom = `-${getComputedStyle(menu).rowGap}`;
        }

        if (reducedMotion.matches) {
            element.hidden = !open;
            return;
        }

        const animation = element.animate(
            [wasHidden ? concealed : current, open ? shown : concealed],
            {
                duration: open ? 500 : 360,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                fill: "both",
            }
        );
        animations.set(element, animation);
        animation.onfinish = () => {
            if (animations.get(element) !== animation) return;
            element.hidden = !open;
            animation.cancel();
            animations.delete(element);
        };
    }

    function setMenuOpen(open) {
        menuOpen = open;
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");

        if (open && menu.hidden) {
            animations.get(projectLinks)?.cancel();
            animations.delete(projectLinks);
            projectsOpen = false;
            projectsToggle.setAttribute("aria-expanded", "false");
            projectLinks.hidden = true;
            projectLinks.inert = true;
        }
        if (!open && menu.contains(document.activeElement)) toggle.focus();
        animateVisibility(menu, open);
    }

    toggle.addEventListener("click", () => setMenuOpen(!menuOpen));

    projectsToggle.addEventListener("click", () => {
        projectsOpen = !projectsOpen;
        projectsToggle.setAttribute("aria-expanded", String(projectsOpen));
        if (!projectsOpen && projectLinks.contains(document.activeElement)) {
            projectsToggle.focus();
        }
        animateVisibility(projectLinks, projectsOpen, true);
    });

    // The toggle handles its own clicks; everything else outside closes it.
    document.addEventListener("click", (event) => {
        if (menuOpen && !menu.contains(event.target) && !toggle.contains(event.target)) {
            setMenuOpen(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && menuOpen) {
            setMenuOpen(false);
            toggle.focus();
        }
    });
}
