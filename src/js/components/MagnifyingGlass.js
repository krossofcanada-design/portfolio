export function initMagnifyingGlass() {

    // The wrapper contains the header, main scene, footer, and magnifier.
    const scene = document.querySelector(".page-surface");
    const magnifier = scene?.querySelector(".magnifier");
    const lens = magnifier?.querySelector(".magnifier_lens");

    if (!scene || !magnifier || !lens) return;

    // Avoid creating a second copy if this function is called twice.
    if (lens.querySelector(".magnified-scene")) return;

    const zoom = 2;
    const refraction = 0.04; // Edge displacement as a fraction of lens width.

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

    // Copy the whole page surface, including the header and footer.
    const magnifiedScene = document.createElement("div");
    magnifiedScene.className = scene.className;
    magnifiedScene.classList.add("magnified-scene");

    for (const child of scene.childNodes) {
        magnifiedScene.appendChild(child.cloneNode(true));
    }

    function cleanCopy(copy) {
        copy.querySelectorAll(".magnifier, script").forEach((element) => {
            element.remove();
        });

        // Avoid duplicate IDs in the visual copy.
        copy.removeAttribute("id");
        copy.querySelectorAll("[id]").forEach((element) => {
            element.removeAttribute("id");
        });
    }

    cleanCopy(magnifiedScene);

    // The copy is visual only; its links must not receive focus.
    magnifiedScene.setAttribute("aria-hidden", "true");
    magnifiedScene.setAttribute("inert", "");

    // Filter a lens-sized window, so the curvature stays centred on the glass.
    const optics = document.createElement("div");
    optics.className = "magnifier_optics";
    optics.appendChild(magnifiedScene);
    lens.appendChild(optics);

    const resizeRefraction = createEdgeRefraction(magnifier, optics, refraction);

    // =========================================
    // POSITION AND MAGNIFICATION
    // =========================================

    function getSceneOrigin() {
        const rect = scene.getBoundingClientRect();

        return {
            x: rect.left + scene.clientLeft - scene.scrollLeft,
            y: rect.top + scene.clientTop - scene.scrollTop,
        };
    }

    function placeGlass(x, y) {
        const halfWidth = magnifier.offsetWidth / 2;
        const halfHeight = magnifier.offsetHeight / 2;

        // Let the centre reach the edges, including header/footer text.
        // The page-surface's overflow: clip trims the overhanging glass.
        const minX = -halfWidth;
        const minY = -halfHeight;
        const maxX = scene.clientWidth - halfWidth;
        const maxY = scene.clientHeight - halfHeight;

        magnifier.style.left = `${Math.max(minX, Math.min(x, maxX))}px`;
        magnifier.style.top = `${Math.max(minY, Math.min(y, maxY))}px`;
        magnifier.style.bottom = "auto";
        magnifier.style.transform = "none";
    }

    function updateLens() {
        const origin = getSceneOrigin();
        const rect = lens.getBoundingClientRect();

        // Locate the actual lens centre within the original scene.
        const centerX = rect.left - origin.x + rect.width / 2;
        const centerY = rect.top - origin.y + rect.height / 2;

        // Keep that same point at the centre of the enlarged copy.
        const offsetX = rect.width / 2 - centerX * zoom;
        const offsetY = rect.height / 2 - centerY * zoom;

        magnifiedScene.style.transform =
            `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    }

    function moveToPointer() {
        const origin = getSceneOrigin();

        placeGlass(
            pointerX - origin.x - dragOffsetX,
            pointerY - origin.y - dragOffsetY
        );

        updateLens();
    }

    function refresh() {
        magnifiedScene.style.width = `${scene.clientWidth}px`;
        magnifiedScene.style.height = `${scene.clientHeight}px`;
        resizeRefraction(lens.clientWidth, lens.clientHeight);

        // Before the first drag, let the original CSS position the glass.
        // After dragging, keep its centre within the page on layout changes.
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

    magnifier.addEventListener("pointerdown", (event) => {
        if (activePointer !== null || !event.isPrimary || event.button !== 0) {
            return;
        }

        const rect = magnifier.getBoundingClientRect();
        const origin = getSceneOrigin();

        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        pointerX = event.clientX;
        pointerY = event.clientY;
        activePointer = event.pointerId;
        hasBeenDragged = true;

        // Preserve the visible position before removing translateX/bottom.
        placeGlass(rect.left - origin.x, rect.top - origin.y);
        updateLens();

        magnifier.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    magnifier.addEventListener("pointermove", (event) => {
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

    function endDrag(event) {
        if (activePointer === null) return;
        if (event.type !== "blur" && event.pointerId !== activePointer) return;

        const pointerId = activePointer;
        activePointer = null;

        if (magnifier.hasPointerCapture(pointerId)) {
            magnifier.releasePointerCapture(pointerId);
        }
    }

    magnifier.addEventListener("pointerup", endDrag);
    magnifier.addEventListener("pointercancel", endDrag);
    magnifier.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("blur", endDrag);
    magnifier.addEventListener("dragstart", (event) => event.preventDefault());

    // Keep the glass under the pointer if the page scrolls during a drag.
    window.addEventListener("scroll", () => {
        if (activePointer !== null) moveToPointer();
    }, { passive: true });

    // =========================================
    // INITIAL DISPLAY AND LAYOUT CHANGES
    // =========================================

    window.addEventListener("resize", scheduleRefresh);
    scene.addEventListener("load", scheduleRefresh, true);

    const resizeObserver = new ResizeObserver(scheduleRefresh);
    resizeObserver.observe(scene);
    resizeObserver.observe(magnifier);

    // Reflect menu opening/closing and changes to header/footer content.
    // Observe the originals only, so dragging cannot trigger a copy loop.
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

        observer.observe(original, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
        });
    }

    if (document.fonts) {
        document.fonts.ready.then(scheduleRefresh);
    }

    // Show the drag hint once, then remove it on interaction.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const hintTimer = window.setTimeout(() => {
            if (!hasBeenDragged) magnifier.classList.add("magnifier--hint");
        }, 1200);

        magnifier.addEventListener("pointerdown", () => {
            window.clearTimeout(hintTimer);
            magnifier.classList.remove("magnifier--hint");
        }, { once: true });
    }

    refresh();
}

// =========================================
// GENTLE REFRACTION NEAR THE GLASS EDGE
// =========================================

function createEdgeRefraction(magnifier, optics, strength) {
    const mapSize = 256;
    const canvas = document.createElement("canvas");
    canvas.width = mapSize;
    canvas.height = mapSize;
    const context = canvas.getContext("2d");

    if (!context) return () => {};

    const map = context.createImageData(mapSize, mapSize);

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const nx = ((x + 0.5) / mapSize) * 2 - 1;
            const ny = ((y + 0.5) / mapSize) * 2 - 1;
            const radius = Math.hypot(nx, ny);

            // The central 55% of the radius stays undistorted.
            const t = Math.max(0, Math.min(1, (radius - 0.55) / 0.45));
            const bend = t * t * (3 - 2 * t);
            const directionX = radius ? nx / radius : 0;
            const directionY = radius ? ny / radius : 0;
            const index = (y * mapSize + x) * 4;

            // Red controls horizontal displacement; green controls vertical.
            // Sampling slightly inward gives the outer glass a curved edge.
            map.data[index] = Math.round(128 - directionX * bend * 127);
            map.data[index + 1] = Math.round(128 - directionY * bend * 127);
            map.data[index + 2] = 128;
            map.data[index + 3] = 255;
        }
    }

    context.putImageData(map, 0, 0);
    const mapURL = canvas.toDataURL("image/png");
    const namespace = "http://www.w3.org/2000/svg";
    const filterId = `magnifier-refraction-${Math.random().toString(36).slice(2)}`;

    function svgElement(name, attributes = {}) {
        const element = document.createElementNS(namespace, name);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, String(value));
        }
        return element;
    }

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
    const image = svgElement("feImage", {
        x: 0,
        y: 0,
        preserveAspectRatio: "none",
        result: "raw-map",
    });
    image.setAttribute("href", mapURL);
    image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", mapURL);

    // Make an encoded value of 128 exactly neutral, keeping the centre crisp.
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

    // Keep the normal magnification visible while the map is decoding.
    const mapImage = new Image();
    mapImage.onload = () => {
        optics.style.filter = `url("#${filterId}")`;
    };
    mapImage.src = mapURL;

    let lastWidth = 0;
    let lastHeight = 0;

    return (width, height) => {
        if (width <= 0 || height <= 0) return;
        if (width === lastWidth && height === lastHeight) return;
        lastWidth = width;
        lastHeight = height;

        filter.setAttribute("width", String(width));
        filter.setAttribute("height", String(height));
        image.setAttribute("width", String(width));
        image.setAttribute("height", String(height));
        displacement.setAttribute("scale", String(Math.min(width, height) * strength * 2));
    };
}
