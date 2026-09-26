/**
 * Progressive enhancement: the project HTML remains the source of truth.
 * Only same-origin project links are enhanced. Failed requests navigate normally.
 */
export class ProjectOverlay {
    #dialog;
    #content;
    #status;
    #controller;
    #opener;
    #scroll;
    #bodyStyles;
    #projectDirectory;
    #onClick;
    #pointerStartedOutside = false;

    constructor({ projectDirectory = new URL("../../../Projects/", import.meta.url) } = {}) {
        this.#projectDirectory = new URL(projectDirectory, document.baseURI);
    }

    init() {
        // Unsupported browsers retain ordinary links, including local file previews.
        if (this.#dialog || typeof HTMLDialogElement === "undefined" ||
            !HTMLDialogElement.prototype.showModal || !window.fetch ||
            !["http:", "https:"].includes(location.protocol)) return this;

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
        this.#content = this.#dialog.querySelector(".project-dialog__content");
        this.#status = this.#dialog.querySelector(".project-dialog__status");

        // Append outside .page-surface so the magnifier does not clone the dialog.
        document.body.append(this.#dialog);
        this.#dialog.querySelector("button").addEventListener("click", () => this.close());
        this.#dialog.addEventListener("cancel", event => {
            event.preventDefault();
            this.close();
        });
        this.#dialog.addEventListener("pointerdown", event => {
            this.#pointerStartedOutside = event.target === this.#dialog;
        });
        this.#dialog.addEventListener("click", event => {
            if (event.target === this.#dialog && this.#pointerStartedOutside) this.close();
            this.#pointerStartedOutside = false;
        });
        this.#dialog.addEventListener("close", () => this.#restorePage());
        this.#onClick = event => this.#handleClick(event);
        document.addEventListener("click", this.#onClick);
        return this;
    }

    #handleClick(event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
            event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest("a[href]");
        if (!link || link.hasAttribute("download") ||
            (link.target && link.target !== "_self") ||
            link.hasAttribute("data-no-project-overlay") ||
            link.closest(".magnifier, .magnified-scene, [inert]")) return;

        const url = new URL(link.href);
        if (url.origin !== location.origin ||
            !url.pathname.startsWith(this.#projectDirectory.pathname) ||
            !url.pathname.endsWith(".html")) return;

        event.preventDefault();
        void this.open(url, link);
    }

    async open(url, opener) {
        this.#controller?.abort();
        const controller = new AbortController();
        this.#controller = controller;

        if (!this.#dialog.open) {
            this.#opener = opener;
            this.#scroll = { x: window.scrollX, y: window.scrollY };
            // Preserve only the styles we touch, including any priorities.
            this.#bodyStyles = ["position", "top", "left", "width"].map(name => ({
                name, value: document.body.style.getPropertyValue(name),
                priority: document.body.style.getPropertyPriority(name)
            }));
            document.body.style.position = "fixed";
            document.body.style.top = `-${this.#scroll.y}px`;
            document.body.style.left = `-${this.#scroll.x}px`;
            document.body.style.width = "100%";
            this.#dialog.showModal();
        }

        this.#dialog.removeAttribute("aria-labelledby");
        this.#content.replaceChildren();
        this.#content.setAttribute("aria-busy", "true");
        this.#status.hidden = false;
        this.#dialog.scrollTop = 0;
        this.#dialog.querySelector("button").focus({ preventScroll: true });

        // Avoid trapping a visitor indefinitely on a stalled connection.
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, 12000);

        try {
            const response = await fetch(url.href, { signal: controller.signal });
            if (!response.ok) throw new Error(`Project returned ${response.status}`);
            const source = new DOMParser().parseFromString(await response.text(), "text/html");
            const article = source.querySelector("[data-project-content]");
            if (!article) throw new Error("Project article not found");

            // ../img/ and sibling project links must keep their project-page base.
            const base = response.url || url.href;
            for (const element of article.querySelectorAll("[src], [href], [poster]")) {
                for (const attribute of ["src", "href", "poster"]) {
                    if (element.hasAttribute(attribute)) {
                        element.setAttribute(attribute, new URL(element.getAttribute(attribute), base).href);
                    }
                }
            }
            // These templates use ordinary src attributes. Use absolute/root-relative
            // URLs if adding srcset or inline background-image in future projects.
            article.querySelectorAll("script").forEach(script => script.remove());
            if (controller.signal.aborted || this.#controller !== controller) return;

            this.#content.append(document.importNode(article, true));
            this.#status.hidden = true;
            this.#content.removeAttribute("aria-busy");
            const heading = this.#content.querySelector("h1");
            if (heading) {
                heading.id ||= "project-overlay-title";
                heading.tabIndex = -1;
                this.#dialog.setAttribute("aria-labelledby", heading.id);
                heading.focus({ preventScroll: true });
            }
            this.#dialog.scrollTop = 0;
        } catch (error) {
            // Closing or choosing another project cancels silently.
            if (this.#controller !== controller || !this.#dialog.open) return;
            if (error.name === "AbortError" && !timedOut) return;
            // An unavailable overlay must never turn a real link into a dead end.
            this.close();
            location.assign(url.href);
        } finally {
            clearTimeout(timeout);
        }
    }

    close() {
        this.#controller?.abort();
        this.#controller = null;
        if (this.#dialog?.open) this.#dialog.close();
        this.#restorePage();
    }

    #restorePage() {
        if (!this.#scroll || this.#dialog?.open) return;
        this.#controller?.abort();
        this.#controller = null;
        this.#content.replaceChildren();
        for (const { name, value, priority } of this.#bodyStyles || []) {
            if (value) document.body.style.setProperty(name, value, priority);
            else document.body.style.removeProperty(name);
        }
        window.scrollTo({ left: this.#scroll.x, top: this.#scroll.y, behavior: "instant" });
        const openerVisible = this.#opener?.isConnected && this.#opener.getClientRects().length;
        const target = openerVisible ? this.#opener : document.querySelector(".menu_toggle");
        target?.focus({ preventScroll: true });
        this.#scroll = null;
        this.#bodyStyles = null;
        this.#opener = null;
    }

    destroy() {
        this.close();
        document.removeEventListener("click", this.#onClick);
        this.#dialog?.remove();
        this.#dialog = null;
    }
}
