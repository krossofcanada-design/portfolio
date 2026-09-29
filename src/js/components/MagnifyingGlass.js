// This js funtion was created with ChatGPT Astra. After adjustments of sizing, initial placement, and the addition of a nudge in SCSS, and of proper refraction that wouldn't be experienced as nauseating, I further asked AI to walk me through the code and add educational comments along the way, so I can follwo the logic.

// Export this setup function so main.js can start the magnifying glass.
// Everything inside runs when initMagnifyingGlass() is called.
export function initMagnifyingGlass() {

    // The page surface contains the header, main scene, footer, and magnifier.
    // ?. safely returns undefined if the element before it was not found.
    const scene = document.querySelector(".page-surface");
    const magnifier = scene?.querySelector(".magnifier");
    const lens = magnifier?.querySelector(".magnifier_lens");

    // Stop if this page does not contain all the required elements.
    if (!scene || !magnifier || !lens) return;

    // Do not create a second copy if setup runs more than once.
    if (lens.querySelector(".magnified-scene")) return;

    // The content appears twice as large. Refraction sets the subtle bend
    // near the edge of the lens.
    const zoom = 2;
    const refraction = 0.04;

    // These values remember the pointer's position and the state of a drag.
    // activePointer is null when nobody is dragging the glass.
    let activePointer = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let hasBeenDragged = false;
    let refreshFrame = 0;

    // =========================================
    // CREATE THE MAGNIFIED COPY
    // =========================================

    // Create a container for a copy of the whole page surface.
    const magnifiedScene = document.createElement("div");
    magnifiedScene.className = scene.className;
    magnifiedScene.classList.add("magnified-scene");

    // Copy each child of the page surface into that container.
    // The original page stays in place; this copy will live inside the lens.
    for (const child of scene.childNodes) {
        magnifiedScene.appendChild(child.cloneNode(true));
    }

    // Remove things the visual copy must not contain: another magnifier,
    // scripts, and IDs that would duplicate IDs on the real page.
    function cleanCopy(copy) {
        copy.querySelectorAll(".magnifier, script").forEach((element) => {
            element.remove();
        });

        copy.removeAttribute("id");
        copy.querySelectorAll("[id]").forEach((element) => {
            element.removeAttribute("id");
        });
    }

    cleanCopy(magnifiedScene);

    // The copy is only an image-like effect. Keyboard and screen reader users
    // should interact with the real page instead of duplicate links.
    magnifiedScene.setAttribute("aria-hidden", "true");
    magnifiedScene.setAttribute("inert", "");

    // Place the copy in a container that receives the curved-edge effect.
    const optics = document.createElement("div");
    optics.className = "magnifier_optics";
    optics.appendChild(magnifiedScene);
    lens.appendChild(optics);

    // Create that edge effect. The returned function lets us resize it later.
    const resizeRefraction = createEdgeRefraction(magnifier, optics, refraction);

    // =========================================
    // POSITION AND MAGNIFICATION
    // =========================================

    // Find the top-left corner of the page content on the screen.
    // Account for its border and any scrolling inside it.
    function getSceneOrigin() {
        const rect = scene.getBoundingClientRect();

        return {
            x: rect.left + scene.clientLeft - scene.scrollLeft,
            y: rect.top + scene.clientTop - scene.scrollTop,
        };
    }

    // Position the glass using coordinates measured from the page surface.
    function placeGlass(x, y) {
        const halfWidth = magnifier.offsetWidth / 2;
        const halfHeight = magnifier.offsetHeight / 2;

        // Limit how far it can travel. Its centre can reach the page edges,
        // while the part that hangs over an edge is clipped by CSS.
        const minX = -halfWidth;
        const minY = -halfHeight;
        const maxX = scene.clientWidth - halfWidth;
        const maxY = scene.clientHeight - halfHeight;

        // Math.min and Math.max keep x and y within those limits.
        magnifier.style.left = `${Math.max(minX, Math.min(x, maxX))}px`;
        magnifier.style.top = `${Math.max(minY, Math.min(y, maxY))}px`;

        // Clear CSS positioning rules used before the first drag.
        magnifier.style.bottom = "auto";
        magnifier.style.transform = "none";
    }

    // Align the enlarged copy with the real content beneath the lens.
    function updateLens() {
        const origin = getSceneOrigin();
        const rect = lens.getBoundingClientRect();

        // Find the lens centre relative to the original page surface.
        const centerX = rect.left - origin.x + rect.width / 2;
        const centerY = rect.top - origin.y + rect.height / 2;

        // Work out how far the enlarged copy must move so that this same
        // point appears in the centre of the lens.
        const offsetX = rect.width / 2 - centerX * zoom;
        const offsetY = rect.height / 2 - centerY * zoom;

        magnifiedScene.style.transform =
            `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    }

    // Move the glass with the pointer without shifting the spot where the
    // person originally grabbed it.
    function moveToPointer() {
        const origin = getSceneOrigin();

        placeGlass(
            pointerX - origin.x - dragOffsetX,
            pointerY - origin.y - dragOffsetY
        );

        updateLens();
    }

    // Recalculate the copy and lens effect when the layout changes.
    function refresh() {
        magnifiedScene.style.width = `${scene.clientWidth}px`;
        magnifiedScene.style.height = `${scene.clientHeight}px`;
        resizeRefraction(lens.clientWidth, lens.clientHeight);

        // Before the first drag, CSS decides where the glass starts.
        // Afterwards, keep it within the page when dimensions change.
        if (hasBeenDragged) {
            if (activePointer !== null) {
                moveToPointer();
                return;
            }

            const origin = getSceneOrigin();
            const rect = magnifier.getBoundingClientRect();
            placeGlass(rect.left - origin.x, rect.top - origin.y);
        }

        updateLens();
    }

    // Several layout events may happen at once. Ask the browser to perform
    // one refresh before its next drawing frame.
    function scheduleRefresh() {
        if (refreshFrame) return;

        refreshFrame = requestAnimationFrame(() => {
            refreshFrame = 0;
            refresh();
        });
    }

    // =========================================
    // DRAG WITH A MOUSE, TOUCHSCREEN, OR PEN
    // =========================================

    // Pointer events cover mouse, touch, and pen interactions.
    magnifier.addEventListener("pointerdown", (event) => {
        // Accept only one drag at a time, from the primary pointer
        // and its main button.
        if (activePointer !== null || !event.isPrimary || event.button !== 0) {
            return;
        }

        const rect = magnifier.getBoundingClientRect();
        const origin = getSceneOrigin();

        // Remember where within the glass the pointer first touched it.
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        pointerX = event.clientX;
        pointerY = event.clientY;
        activePointer = event.pointerId;
        hasBeenDragged = true;

        // Keep the glass in its current visible position while switching
        // from its initial CSS placement to JavaScript placement.
        placeGlass(rect.left - origin.x, rect.top - origin.y);
        updateLens();

        // Continue receiving movement even if the pointer leaves the glass.
        magnifier.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    magnifier.addEventListener("pointermove", (event) => {
        // Ignore movement from any pointer other than the one dragging.
        if (event.pointerId !== activePointer) return;

        // Recover if the mouse button was released outside the window.
        if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
            endDrag(event);
            return;
        }

        pointerX = event.clientX;
        pointerY = event.clientY;
        moveToPointer();
    });

    // Clear the drag state when the interaction ends.
    function endDrag(event) {
        if (activePointer === null) return;
        if (event.type !== "blur" && event.pointerId !== activePointer) return;

        const pointerId = activePointer;
        activePointer = null;

        if (magnifier.hasPointerCapture(pointerId)) {
            magnifier.releasePointerCapture(pointerId);
        }
    }

    // A drag can end in several ways, so all of them use the same cleanup.
    magnifier.addEventListener("pointerup", endDrag);
    magnifier.addEventListener("pointercancel", endDrag);
    magnifier.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("blur", endDrag);

    // Prevent the browser's built-in dragging from competing with ours.
    magnifier.addEventListener("dragstart", (event) => event.preventDefault());

    // If the page scrolls during a drag, recalculate the pointer's position
    // relative to the page surface.
    window.addEventListener("scroll", () => {
        if (activePointer !== null) moveToPointer();
    }, { passive: true });

    // =========================================
    // INITIAL DISPLAY AND LAYOUT CHANGES
    // =========================================

    // Window resizing or loaded images can shift content beneath the lens.
    window.addEventListener("resize", scheduleRefresh);
    scene.addEventListener("load", scheduleRefresh, true);

    // Watch the size of the page and magnifier themselves.
    const resizeObserver = new ResizeObserver(scheduleRefresh);
    resizeObserver.observe(scene);
    resizeObserver.observe(magnifier);

    // The menu and header/footer content can change after we first copy them.
    // Watch the originals and replace those parts of the visual copy.
    for (const selector of [".site-header", ".site-footer"]) {
        const original = scene.querySelector(`:scope > ${selector}`);
        let copy = magnifiedScene.querySelector(`:scope > ${selector}`);

        if (!original || !copy) continue;

        const observer = new MutationObserver(() => {
            const replacement = original.cloneNode(true);
            cleanCopy(replacement);
            copy.replaceWith(replacement);
            copy = replacement;
            scheduleRefresh();
        });

        // Include changes to attributes, elements, and text further inside.
        observer.observe(original, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
        });
    }

    // Fonts can alter text widths after the page first appears.
    if (document.fonts) {
        document.fonts.ready.then(scheduleRefresh);
    }

    // Show a one-time drag hint unless the person prefers reduced motion.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const hintTimer = window.setTimeout(() => {
            if (!hasBeenDragged) magnifier.classList.add("magnifier--hint");
        }, 1200);

        // Remove the hint when the person first interacts with the glass.
        magnifier.addEventListener("pointerdown", () => {
            window.clearTimeout(hintTimer);
            magnifier.classList.remove("magnifier--hint");
        }, { once: true });
    }

    // Measure and align everything when the function first runs.
    refresh();
}

// =========================================
// GENTLE REFRACTION NEAR THE GLASS EDGE
// =========================================

// Create a small image called a displacement map. Its red and green values
// tell an SVG filter how to bend pixels near the edge of the lens.
// Return a function that updates this effect when the lens changes size.
function createEdgeRefraction(magnifier, optics, strength) {
    // This canvas generates the map; it is never displayed on the page.
    const mapSize = 256;
    const canvas = document.createElement("canvas");
    canvas.width = mapSize;
    canvas.height = mapSize;
    const context = canvas.getContext("2d");

    // If canvas is unavailable, keep the normal magnification.
    if (!context) return () => {};

    const map = context.createImageData(mapSize, mapSize);

    // Visit every pixel in the map. Convert its x/y position into numbers
    // from -1 to 1, with (0, 0) at the centre.
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const nx = ((x + 0.5) / mapSize) * 2 - 1;
            const ny = ((y + 0.5) / mapSize) * 2 - 1;
            const radius = Math.hypot(nx, ny);

            // Keep the central 55% of the radius undistorted.
            // Gradually increase the bend toward the outer edge.
            const t = Math.max(0, Math.min(1, (radius - 0.55) / 0.45));
            const bend = t * t * (3 - 2 * t);
            const directionX = radius ? nx / radius : 0;
            const directionY = radius ? ny / radius : 0;
            const index = (y * mapSize + x) * 4;

            // Red determines horizontal movement; green determines vertical
            // movement. Blue and opacity receive fixed values.
            map.data[index] = Math.round(128 - directionX * bend * 127);
            map.data[index + 1] = Math.round(128 - directionY * bend * 127);
            map.data[index + 2] = 128;
            map.data[index + 3] = 255;
        }
    }

    // Convert those pixel values into an image the SVG filter can use.
    context.putImageData(map, 0, 0);
    const mapURL = canvas.toDataURL("image/png");
    const namespace = "http://www.w3.org/2000/svg";
    const filterId = `magnifier-refraction-${Math.random().toString(36).slice(2)}`;

    // SVG elements use a different namespace from ordinary HTML elements.
    // This helper creates one and adds the attributes we specify.
    function svgElement(name, attributes = {}) {
        const element = document.createElementNS(namespace, name);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, String(value));
        }
        return element;
    }

    // Store the filter definition in an invisible SVG.
    const svg = svgElement("svg", {
        width: 0,
        height: 0,
        "aria-hidden": "true",
        focusable: "false",
    });
    svg.style.position = "absolute";
    svg.style.pointerEvents = "none";

    const defs = svgElement("defs");
    const filter = svgElement("filter", {
        id: filterId,
        filterUnits: "userSpaceOnUse",
        primitiveUnits: "userSpaceOnUse",
        x: 0,
        y: 0,
        "color-interpolation-filters": "sRGB",
    });

    // Supply our generated map to the filter.
    const image = svgElement("feImage", {
        x: 0,
        y: 0,
        preserveAspectRatio: "none",
        result: "raw-map",
    });
    image.setAttribute("href", mapURL);
    image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", mapURL);

    // Make the map's middle value exactly neutral, so the lens centre
    // stays clear rather than shifting slightly.
    const neutralMap = svgElement("feComponentTransfer", {
        in: "raw-map",
        result: "refraction-map",
    });
    for (const channel of ["feFuncR", "feFuncG"]) {
        neutralMap.appendChild(svgElement(channel, {
            type: "linear",
            slope: 1,
            intercept: -0.5 / 255,
        }));
    }

    // Read red as horizontal movement and green as vertical movement.
    // The effect's scale starts at zero until we know the lens size.
    const displacement = svgElement("feDisplacementMap", {
        in: "SourceGraphic",
        in2: "refraction-map",
        xChannelSelector: "R",
        yChannelSelector: "G",
        scale: 0,
    });

    filter.append(image, neutralMap, displacement);
    defs.appendChild(filter);
    svg.appendChild(defs);
    magnifier.appendChild(svg);

    // Wait until the map image has loaded before applying the filter.
    // The ordinary magnification remains visible in the meantime.
    const mapImage = new Image();
    mapImage.onload = () => {
        optics.style.filter = `url("#${filterId}")`;
    };
    mapImage.src = mapURL;

    let lastWidth = 0;
    let lastHeight = 0;

    // Return a function that fits the filter to the current lens size.
    return (width, height) => {
        // Skip missing dimensions or a size we have already handled.
        if (width <= 0 || height <= 0) return;
        if (width === lastWidth && height === lastHeight) return;
        lastWidth = width;
        lastHeight = height;

        filter.setAttribute("width", String(width));
        filter.setAttribute("height", String(height));
        image.setAttribute("width", String(width));
        image.setAttribute("height", String(height));

        // Keep the bend proportional to the smaller lens dimension.
        displacement.setAttribute(
            "scale",
            String(Math.min(width, height) * strength * 2)
        );
    };
}