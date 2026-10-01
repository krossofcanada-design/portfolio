// main.js imports all js modules and connects them to index.html and about.html


import { initMagnifyingGlass } from "./components/MagnifyingGlass.js";

initMagnifyingGlass();

import { initMenu } from "./components/Menu.js";

initMenu();

import { ProjectOverlay } from "./components/ProjectOverlay.js";

// OOP — instantiation: new creates a ProjectOverlay object and runs its constructor.
// One shared instance handles the notebook, menu, and next/previous links.
const projectOverlay = new ProjectOverlay();
// OOP — public method call: ask the object to set up its own dialog and listeners.
projectOverlay.init();