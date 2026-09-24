export function initMagnifyingGlass() {

    const magnifier = document.querySelector(".magnifier");
    const lens = document.querySelector(".magnifier_lens");
    const scene = document.querySelector(".scene");

    if (!magnifier || !lens || !scene) return;

    let isDragging = false;

    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const zoom = 2;


    // =========================================
    // CREATE MAGNIFIED SCENE
    // =========================================

    const magnifiedScene = scene.cloneNode(true);

    magnifiedScene.classList.remove("scene");
    magnifiedScene.classList.add("magnified-scene");

    const clonedMagnifier =
        magnifiedScene.querySelector(".magnifier");

    if (clonedMagnifier) {
        clonedMagnifier.remove();
    }

    lens.appendChild(magnifiedScene);


    // =========================================
    // SET CLONE TO EXACT SCENE SIZE
    // =========================================

    function updateMagnifiedScene() {

        const sceneWidth = scene.offsetWidth;
        const sceneHeight = scene.offsetHeight;

        magnifiedScene.style.width = `${sceneWidth}px`;
        magnifiedScene.style.height = `${sceneHeight}px`;
    }

    updateMagnifiedScene();


    // =========================================
    // DRAG START
    // =========================================

    magnifier.addEventListener("mousedown", (event) => {

        isDragging = true;

        const rect = magnifier.getBoundingClientRect();

        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;

        magnifier.style.bottom = "auto";
        magnifier.style.transform = "none";

        event.preventDefault();
    });


    // =========================================
    // DRAGGING
    // =========================================

    document.addEventListener("mousemove", (event) => {

        if (!isDragging) return;

        const sceneRect = scene.getBoundingClientRect();
        const magnifierRect = magnifier.getBoundingClientRect();

        let x =
            event.clientX -
            sceneRect.left -
            dragOffsetX;

        let y =
            event.clientY -
            sceneRect.top -
            dragOffsetY;


        // Keep glass inside scene

        x = Math.max(
            0,
            Math.min(
                x,
                sceneRect.width - magnifierRect.width
            )
        );

        y = Math.max(
            0,
            Math.min(
                y,
                sceneRect.height - magnifierRect.height
            )
        );


        // =========================================
        // MOVE GLASS
        // =========================================

        magnifier.style.left = `${x}px`;
        magnifier.style.top = `${y}px`;


        // =========================================
        // FIND POINT UNDER LENS CENTER
        // =========================================

        const lensCenterX =
            x + magnifierRect.width / 2;

        const lensCenterY =
            y + magnifierRect.height / 2;


        // =========================================
        // POSITION MAGNIFIED CONTENT
        // =========================================

        const magnifiedLeft =
            magnifierRect.width / 2 -
            lensCenterX * zoom;

        const magnifiedTop =
            magnifierRect.height / 2 -
            lensCenterY * zoom;


        magnifiedScene.style.left =
            `${magnifiedLeft}px`;

        magnifiedScene.style.top =
            `${magnifiedTop}px`;

        magnifiedScene.style.transform =
            `scale(${zoom})`;
    });


    // =========================================
    // DRAG END
    // =========================================

    document.addEventListener("mouseup", () => {

        isDragging = false;

    });


    // =========================================
    // RESPONSIVE
    // =========================================

    window.addEventListener("resize", () => {

        updateMagnifiedScene();

    });

}