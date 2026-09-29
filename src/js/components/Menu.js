// Export the setup function so another file, such as main.js,
// can import it and start the menu.
export function initMenu() {
    // Find the menu button, the menu itself, the Projects button,
    // and the list of project links in the HTML.
    const toggle = document.querySelector(".menu_toggle");
    const menu = document.querySelector("#main-menu");
    const projectsToggle = document.querySelector(".projects-toggle");
    const projectLinks = document.querySelector("#project-links");

    // Stop if this page does not contain all the menu elements.
    if (!toggle || !menu || !projectsToggle || !projectLinks) return;

    // Set the main menu to either its open or closed state.
    // "open" is a Boolean: true or false.
    function setMenuOpen(open) {
        // hidden is the opposite of open:
        // when open is true, hidden becomes false.
        menu.hidden = !open;

        // Tell assistive technology whether the menu button
        // currently controls an expanded menu.
        toggle.setAttribute("aria-expanded", String(open));

        // Give the button a label that describes its current action.
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");

        // Each time the main menu opens, start with the Projects
        // subsection closed.
        if (open) {
            projectsToggle.setAttribute("aria-expanded", "false");
            projectLinks.hidden = true;
        }
    }

    // Open the main menu if it is hidden; close it if it is visible.
    toggle.addEventListener("click", () => {
        setMenuOpen(menu.hidden);
    });

    // Expand or collapse the project links inside the menu.
    projectsToggle.addEventListener("click", () => {
        // HTML attributes contain text, so compare the value with "true".
        const expanded =
            projectsToggle.getAttribute("aria-expanded") === "true";

        // Reverse the current state. If expanded was true,
        // aria-expanded becomes false and the links become hidden.
        projectsToggle.setAttribute("aria-expanded", String(!expanded));
        projectLinks.hidden = expanded;
    });

    // Let a keyboard user close the menu with Escape.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !menu.hidden) {
            setMenuOpen(false);

            // Return keyboard focus to the button that opens the menu.
            toggle.focus();
        }
    });
}