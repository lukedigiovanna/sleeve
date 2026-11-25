import { createLifecycle } from "../app/lifecycle";
import { renderBrandLogo } from "./brandLogo";
export interface SwipeMotion {
  duration: number;
  easing: string;
}

export interface TabIndicator {
  followSwipe(position: number, motion?: SwipeMotion): void;
  resetSwipe(): void;
}

interface Header {
  indicator: TabIndicator;
  dispose(): void;
}

export function initializeHeader(): Header {
  const lifecycle = createLifecycle();
  const header = document.querySelector<HTMLElement>(".masthead")!;
  const divider = new NavDivider(
    header.querySelector<HTMLElement>(".main-nav")!,
  );
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
  return {
    indicator: divider,
    dispose() {
      divider.dispose();
      lifecycle.dispose();
    },
  };
}

interface TabBounds {
  left: number;
  width: number;
}

class NavDivider implements TabIndicator {
  private readonly nav: HTMLElement;
  private readonly divider: HTMLElement;
  private readonly links: HTMLAnchorElement[];
  private readonly selection = new MutationObserver(() =>
    this.updateSelection(),
  );
  private readonly layout = new ResizeObserver(() => this.measure());
  private bounds: TabBounds[] = [];
  private swipePosition: number | undefined;

  constructor(nav: HTMLElement) {
    this.nav = nav;
    this.divider = nav.querySelector<HTMLElement>(".main-nav-divider")!;
    this.links = [...nav.querySelectorAll<HTMLAnchorElement>("[data-nav]")];
    this.selection.observe(nav, {
      attributes: true,
      attributeFilter: ["aria-current"],
      subtree: true,
    });
    this.layout.observe(nav);
    for (const link of this.links) this.layout.observe(link);
    this.measure();
  }

  private measure(): void {
    const origin = this.nav.getBoundingClientRect().left;
    this.bounds = this.links.map((link) => {
      const bounds = link.getBoundingClientRect();
      return { left: bounds.left - origin, width: bounds.width };
    });
    if (this.swipePosition === undefined) this.updateSelection();
    else this.draw(this.swipePosition);
  }

  private updateSelection(): void {
    if (this.swipePosition !== undefined) return;

    const index = this.links.findIndex(
      (link) => link.getAttribute("aria-current") === "page",
    );
    this.divider.hidden = index < 0;
    if (index >= 0) this.draw(index);
  }

  private draw(position: number): void {
    const index = Math.floor(position);
    const fraction = position - index;
    const from = this.bounds[index];
    const to = this.bounds[index + 1] ?? from;
    this.divider.style.left = `${from.left + (to.left - from.left) * fraction}px`;
    this.divider.style.width = `${from.width + (to.width - from.width) * fraction}px`;
  }

  public followSwipe(position: number, motion?: SwipeMotion): void {
    this.swipePosition = position;
    this.divider.style.transitionDuration = `${motion?.duration ?? 0}ms`;
    this.divider.style.transitionTimingFunction = motion?.easing ?? "";
    this.draw(position);
  }

  public resetSwipe(): void {
    this.swipePosition = undefined;
    this.divider.style.transitionDuration = "";
    this.divider.style.transitionTimingFunction = "";
    this.updateSelection();
  }

  public dispose(): void {
    this.selection.disconnect();
    this.layout.disconnect();
  }
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
