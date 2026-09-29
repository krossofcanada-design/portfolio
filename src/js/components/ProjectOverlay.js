/**
 * This class lets a project page appear in a dialog above the current page.
 *
 * The project still has its own HTML page and ordinary link. If the overlay
 * cannot work, the visitor can navigate to that page normally. Adding an
 * optional feature to an already working link is called progressive enhancement.
 */

export class ProjectOverlay {
    // Fields beginning with # are private. Only methods inside this class
    // can read or change them.
    #dialog;            // The <dialog> element.
    #content;           // Where the project article will be inserted.
    #status;            // The "Loading project…" message.
    #controller;        // Lets us cancel a request that is still loading.
    #opener;            // The link that opened the dialog.
    #scroll;            // The page's scroll position before opening.
    #bodyStyles;        // The body's original inline positioning styles.
    #projectDirectory;  // The directory containing project HTML pages.
    #onClick;           // Our document click handler.
    #pointerStartedOutside = false;

    // The constructor prepares the object. A different project directory
    // can be supplied; otherwise it uses ../../../Projects/ relative to
    // this JavaScript module.
    constructor({ projectDirectory = new URL("../../../Projects/", import.meta.url) } = {}) {
        this.#projectDirectory = new URL(projectDirectory, document.baseURI);
    }

    // Set up the dialog and its event listeners. Call this once after
    // creating a ProjectOverlay object.
    init() {
        // If a required browser feature is unavailable, keep the ordinary
        // links working. This also covers local file:// previews.
        if (this.#dialog || typeof HTMLDialogElement === "undefined" ||
            !HTMLDialogElement.prototype.showModal || !window.fetch ||
            !["http:", "https:"].includes(location.protocol)) return this;

        // Create the dialog's HTML with a close button, loading message,
        // and an empty space for the project article.
        this.#dialog = document.createElement("dialog");
        this.#dialog.className = "project-dialog";
        this.#dialog.setAttribute("aria-label", "Project showcase");
        this.#dialog.innerHTML = `
            <div class="project-dialog__paper">
                <div class="project-dialog__toolbar">
                    <button class="project-dialog__close" type="button" aria-label="Close project">×</button>
                </div>
                <p class="project-dialog__status" role="status">Loading project…</p>
                <div class="project-dialog__content"></div>
            </div>`;

        // Keep references to the elements we will update later.
        this.#content = this.#dialog.querySelector(".project-dialog__content");
        this.#status = this.#dialog.querySelector(".project-dialog__status");

        // Put the dialog outside .page-surface. Otherwise the magnifying
        // glass could include it in its copy of the page.
        document.body.append(this.#dialog);

        // Close when the visitor uses the close button.
        this.#dialog.querySelector("button").addEventListener("click", () => this.close());

        // A dialog's "cancel" event normally closes it when Escape is
        // pressed. Route it through our close() method for cleanup.
        this.#dialog.addEventListener("cancel", event => {
            event.preventDefault();
            this.close();
        });

        // Remember whether a press began on the backdrop, outside the
        // paper area. This prevents a drag that ends there from closing it.
        this.#dialog.addEventListener("pointerdown", event => {
            this.#pointerStartedOutside = event.target === this.#dialog;
        });

        // Close when a full click occurs on the backdrop.
        this.#dialog.addEventListener("click", event => {
            if (event.target === this.#dialog && this.#pointerStartedOutside) this.close();
            this.#pointerStartedOutside = false;
        });

        // Restore the page if the dialog closes, including by another
        // piece of code calling its native close() method.
        this.#dialog.addEventListener("close", () => this.#restorePage());

        // Listen for clicks anywhere in the document. #handleClick decides
        // whether each clicked link should open in the overlay.
        this.#onClick = event => this.#handleClick(event);
        document.addEventListener("click", this.#onClick);

        // Returning this allows code such as new ProjectOverlay().init().
        return this;
    }

    // Decide whether a clicked link qualifies for the overlay.
    #handleClick(event) {
        // Respect clicks already handled by other code, non-primary mouse
        // buttons, and modifier keys used to open links differently.
        if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
            event.ctrlKey || event.shiftKey || event.altKey) return;

        // Find the nearest link, even if the visitor clicked an element
        // inside that link.
        const link = event.target.closest("a[href]");

        // Leave downloads, links targeting another window, excluded links,
        // and the magnifier's noninteractive copy alone.
        if (!link || link.hasAttribute("download") ||
            (link.target && link.target !== "_self") ||
            link.hasAttribute("data-no-project-overlay") ||
            link.closest(".magnifier, .magnified-scene, [inert]")) return;

        const url = new URL(link.href);

        // Only open HTML files inside this site's project directory.
        // Other links keep their normal behavior.
        if (url.origin !== location.origin ||
            !url.pathname.startsWith(this.#projectDirectory.pathname) ||
            !url.pathname.endsWith(".html")) return;

        // Stop normal navigation because we are opening this link in the
        // dialog instead. "void" shows that we are starting an async
        // operation without waiting for it here.
        event.preventDefault();
        void this.open(url, link);
    }

    // Fetch a project's HTML and show its article in the dialog.
    async open(url, opener) {
        // Cancel a previous project request if another project is chosen.
        this.#controller?.abort();
        const controller = new AbortController();
        this.#controller = controller;

        // Set up the page only when opening a previously closed dialog.
        if (!this.#dialog.open) {
            // Remember the link and scroll position so we can restore them.
            this.#opener = opener;
            this.#scroll = { x: window.scrollX, y: window.scrollY };

            // Save only the body's inline styles that this method changes.
            // Also save any !important priority those values had.
            this.#bodyStyles = ["position", "top", "left", "width"].map(name => ({
                name, value: document.body.style.getPropertyValue(name),
                priority: document.body.style.getPropertyPriority(name)
            }));

            // Fix the body in place so the page behind the dialog does
            // not scroll while the project is open.
            document.body.style.position = "fixed";
            document.body.style.top = `-${this.#scroll.y}px`;
            document.body.style.left = `-${this.#scroll.x}px`;
            document.body.style.width = "100%";

            // showModal() opens a native dialog and moves focus into it.
            this.#dialog.showModal();
        }

        // Clear the previous project and prepare a loading state.
        this.#dialog.removeAttribute("aria-labelledby");
        this.#content.replaceChildren();
        this.#content.setAttribute("aria-busy", "true");
        this.#status.hidden = false;
        this.#dialog.scrollTop = 0;
        this.#dialog.querySelector("button").focus({ preventScroll: true });

        // Cancel a request that has stalled for more than 12 seconds.
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, 12000);

        try {
            // Download the actual project HTML page.
            // The controller's signal lets us cancel this fetch.
            const response = await fetch(url.href, { signal: controller.signal });
            if (!response.ok) throw new Error(`Project returned ${response.status}`);

            // Turn the returned HTML text into a separate document and
            // find the article marked as project content.
            const source = new DOMParser().parseFromString(await response.text(), "text/html");
            const article = source.querySelector("[data-project-content]");
            if (!article) throw new Error("Project article not found");

            // Relative image paths and links were written for the project
            // page. Convert them to full URLs so they still work when that
            // article is inserted into the current page's dialog.
            const base = response.url || url.href;
            for (const element of article.querySelectorAll("[src], [href], [poster]")) {
                for (const attribute of ["src", "href", "poster"]) {
                    if (element.hasAttribute(attribute)) {
                        element.setAttribute(attribute, new URL(element.getAttribute(attribute), base).href);
                    }
                }
            }

            // These templates use ordinary src attributes. If future project
            // pages use srcset or CSS background images, those paths will
            // need to be made absolute or root-relative too.
            article.querySelectorAll("script").forEach(script => script.remove());

            // A newer request may have replaced this one while it loaded.
            // In that case, do not insert the outdated project.
            if (controller.signal.aborted || this.#controller !== controller) return;

            // Import the article into the current document, hide the
            // loading message, and mark loading as finished.
            this.#content.append(document.importNode(article, true));
            this.#status.hidden = true;
            this.#content.removeAttribute("aria-busy");

            // Use the project's main heading as the dialog's accessible
            // name and move keyboard focus to that heading.
            const heading = this.#content.querySelector("h1");
            if (heading) {
                heading.id ||= "project-overlay-title";
                heading.tabIndex = -1;
                this.#dialog.setAttribute("aria-labelledby", heading.id);
                heading.focus({ preventScroll: true });
            }

            this.#dialog.scrollTop = 0;
        } catch (error) {
            // Closing the dialog or choosing a different project cancels
            // the old request intentionally, so there is nothing to show.
            if (this.#controller !== controller || !this.#dialog.open) return;
            if (error.name === "AbortError" && !timedOut) return;

            // If the project cannot be shown in the overlay, follow its
            // real link so the visitor can still reach the project page.
            this.close();
            location.assign(url.href);
        } finally {
            // Stop the timer whether the request succeeded or failed.
            clearTimeout(timeout);
        }
    }

    // Close the dialog and cancel any request still loading.
    close() {
        this.#controller?.abort();
        this.#controller = null;
        if (this.#dialog?.open) this.#dialog.close();
        this.#restorePage();
    }

    // Put the underlying page back the way it was before opening.
    #restorePage() {
        // Do nothing if there is no saved state or the dialog is still open.
        if (!this.#scroll || this.#dialog?.open) return;

        this.#controller?.abort();
        this.#controller = null;
        this.#content.replaceChildren();

        // Restore each original inline style. If it had no value before,
        // remove the inline property we added.
        for (const { name, value, priority } of this.#bodyStyles || []) {
            if (value) document.body.style.setProperty(name, value, priority);
            else document.body.style.removeProperty(name);
        }

        // Return to the page position from before the overlay opened.
        window.scrollTo({ left: this.#scroll.x, top: this.#scroll.y, behavior: "instant" });

        // Return keyboard focus to the link that opened the project.
        // If that link is no longer visible, use the menu button.
        const openerVisible = this.#opener?.isConnected && this.#opener.getClientRects().length;
        const target = openerVisible ? this.#opener : document.querySelector(".menu_toggle");
        target?.focus({ preventScroll: true });

        // Clear the saved state until the next time a project opens.
        this.#scroll = null;
        this.#bodyStyles = null;
        this.#opener = null;
    }

    // Completely remove this overlay's listeners and dialog.
    // This is useful if the component is intentionally taken out of use.
    destroy() {
        this.close();
        document.removeEventListener("click", this.#onClick);
        this.#dialog?.remove();
        this.#dialog = null;
    }
}