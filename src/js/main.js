// main.js imports all js modules and connects them to index.html and about.html


import { initMagnifyingGlass } from "./components/MagnifyingGlass.js";

initMagnifyingGlass();

import { initMenu } from "./components/Menu.js";

initMenu();

import { ProjectOverlay } from "./components/ProjectOverlay.js";

// One shared instance handles the notebook, menu, and next/previous links.
const projectOverlay = new ProjectOverlay();
projectOverlay.init();