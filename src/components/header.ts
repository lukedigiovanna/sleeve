import { createLifecycle } from "../app/lifecycle";
import { renderBrandLogo } from "./brandLogo";
export function initializeHeader(): () => void {
  const lifecycle = createLifecycle();
  const header = document.querySelector<HTMLElement>(".masthead");
  if (!header) return () => lifecycle.dispose();

  const disposeDivider = initializeDivider(header);
  const mobile = window.matchMedia("(max-width: 700px)");
  let lastY = window.scrollY;
  let travel = 0;

  function showHeader() {
    header!.classList.remove("masthead-hidden");
    travel = 0;
    lastY = window.scrollY;
  }

  lifecycle.listen(window).addEventListener(
    "scroll",
    () => {
      // Clamp elastic overscroll so bouncing at either end cannot hide the nav.
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const y = Math.min(maxY, Math.max(0, window.scrollY));
      const delta = y - lastY;
      lastY = y;

      if (
        !mobile.matches ||
        y <= header.offsetHeight ||
        header.contains(document.activeElement) ||
        document.querySelector("dialog[open]")
      ) {
        showHeader();
        return;
      }

      if (delta === 0) return;
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel > 32) header.classList.add("masthead-hidden");
      if (travel < -10) header.classList.remove("masthead-hidden");
    },
    { passive: true },
  );
  lifecycle.listen(header).addEventListener("focusin", showHeader);
  lifecycle.listen(window).addEventListener("hashchange", showHeader);
  lifecycle.listen(mobile).addEventListener("change", showHeader);
  return () => {
    disposeDivider();
    lifecycle.dispose();
  };
}

function initializeDivider(header: HTMLElement): () => void {
  const nav = header.querySelector<HTMLElement>(".main-nav")!;
  const divider = nav.querySelector<HTMLElement>(".main-nav-divider")!;

  function updateDivider(): void {
    const tab = nav.querySelector<HTMLElement>('[aria-current="page"]');
    divider.hidden = !tab;
    if (!tab) return;

    const bounds = tab.getBoundingClientRect();
    divider.style.left = `${bounds.left - nav.getBoundingClientRect().left}px`;
    divider.style.width = `${bounds.width}px`;
  }

  const selection = new MutationObserver(updateDivider);
  selection.observe(nav, {
    attributes: true,
    attributeFilter: ["aria-current"],
    subtree: true,
  });
  const layout = new ResizeObserver(updateDivider);
  layout.observe(nav);
  for (const tab of nav.querySelectorAll("a")) layout.observe(tab);
  updateDivider();

  return () => {
    selection.disconnect();
    layout.disconnect();
  };
}

export function renderHeader(): string {
  return /* HTML */ `
    <header class="masthead">
      <div class="frame masthead-inner">
        <a class="brand" href="#" aria-label="Sleeve library"
          >${renderBrandLogo()}<span class="brand-wordmark"
            >Sleeve<span class="brand-period">.</span></span
          ></a
        >
        <nav class="main-nav" aria-label="Main navigation">
          <a href="#" data-nav="library">Library</a
          ><a href="#artists" data-nav="artists">Artists</a
          ><a href="#genres" data-nav="genres">Genres</a
          ><a href="#instruments" data-nav="instruments">Instruments</a>
          <span class="main-nav-divider" aria-hidden="true" hidden></span>
        </nav>
        <button
          type="button"
          class="button top-add"
          data-action="add"
          id="top-add"
          aria-label="Add album"
        >
          <span id="add-icon"></span>
        </button>
      </div>
    </header>
  `;
}
