import { isLibraryRoute } from "./libraryUrl";
import { createLifecycle } from "./lifecycle";
import type { SwipeMotion, TabIndicator } from "../components/header";

interface SwipeSample {
  x: number;
  time: number;
}

interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  horizontal: boolean;
  index: number;
  width: number;
  pageTop: number;
  offset: number;
  samples: SwipeSample[];
}

interface Preview {
  direction: -1 | 1;
  hash: string;
  page: HTMLElement;
}

interface Settlement {
  timer: number;
  complete: () => void;
}

interface TabNavigationDependencies {
  indicator: TabIndicator;
  prepareTab: (hash: string) => HTMLElement;
  restoreTab: (hash: string, page: HTMLElement) => void;
  tabScroll: (hash: string) => number;
}

class TabNavigation {
  private readonly lifecycle = createLifecycle();
  private readonly main = document.querySelector<HTMLElement>("main")!;
  private readonly swipeViewport = document.createElement("div");
  private readonly links = [
    ...document.querySelectorAll<HTMLAnchorElement>(".main-nav [data-nav]"),
  ];
  private readonly reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private readonly mobile = window.matchMedia("(max-width: 700px)");
  private readonly observer = new MutationObserver(() => this.cleanup());
  private readonly dependencies: TabNavigationDependencies;
  private gesture: Gesture | undefined;
  private previews: Preview[] = [];
  private settlement: Settlement | undefined;

  constructor(dependencies: TabNavigationDependencies) {
    this.dependencies = dependencies;
    this.swipeViewport.className = "swipe-viewport";
    const main = this.lifecycle.listen(this.main);
    main.addEventListener("pointerdown", (event) => this.start(event));
    main.addEventListener("pointermove", (event) => this.drag(event));
    main.addEventListener("pointerup", (event) => this.end(event, true));
    main.addEventListener("pointercancel", (event) => this.end(event, false));
    main.addEventListener("transitionend", (event) => {
      if (event.target === this.main && event.propertyName === "transform")
        this.settlement?.complete();
    });
    // A drag starting on a link must not open it after the swipe.
    main.addEventListener(
      "click",
      (event) => {
        if (this.gesture?.horizontal) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );

    const windowEvents = this.lifecycle.listen(window);
    windowEvents.addEventListener("hashchange", () => this.cleanup());
    windowEvents.addEventListener("resize", () => {
      if (this.gesture && this.gesture.width !== window.innerWidth)
        this.cleanup();
    });
    this.lifecycle.listen(this.mobile).addEventListener("change", () => {
      this.cleanup();
    });
    this.observer.observe(this.main, { childList: true });
    this.cleanup();
  }

  private pageIndex(): number {
    return this.links.findIndex((link) =>
      isLibraryRoute(location.hash)
        ? link.dataset.nav === "library"
        : link.hash === location.hash,
    );
  }

  private cleanup(): void {
    clearTimeout(this.settlement?.timer);
    this.settlement = undefined;

    for (const { hash, page } of this.previews) {
      page.style.visibility = "";
      page.style.transform = "";
      page.style.transition = "";
      this.dependencies.restoreTab(hash, page);
    }
    this.previews = [];
    this.swipeViewport.remove();
    this.main.style.willChange = "";
    if (this.gesture?.horizontal) {
      this.main.style.transform = "";
      this.main.style.transition = "";
      document.body.classList.remove("swiping-pages");
      this.dependencies.indicator.resetSwipe();
    }
    this.gesture = undefined;
  }

  private mountPreviews(start: Gesture): void {
    document.body.append(this.swipeViewport);

    for (const direction of [-1, 1] as const) {
      const link = this.links[start.index + direction];
      if (!link) continue;

      const hash = link.hash;
      const page = this.dependencies.prepareTab(hash);
      const top = start.pageTop - this.dependencies.tabScroll(hash);
      page.style.top = `${top}px`;
      page.style.transform = `translate3d(${direction * start.width}px, 0, 0)`;
      this.swipeViewport.append(page);
      this.previews.push({ direction, hash, page });
    }
  }

  private move(start: Gesture, dx: number, motion?: SwipeMotion): void {
    start.offset = dx;
    this.main.style.transform = `translate3d(${dx}px, 0, 0)`;
    for (const { direction, page } of this.previews) {
      page.style.transform = `translate3d(${direction * start.width + dx}px, 0, 0)`;
    }
    const position = Math.max(
      0,
      Math.min(this.links.length - 1, start.index - dx / start.width),
    );
    this.dependencies.indicator.followSwipe(position, motion);
  }

  private start(event: PointerEvent): void {
    if (event.pointerType !== "touch" || this.settlement !== undefined) return;
    if (!event.isPrimary) {
      this.finish();
      return;
    }

    const index = this.pageIndex();
    const { clientX: x, clientY: y } = event;
    const width = window.innerWidth;
    if (
      !this.mobile.matches ||
      index < 0 ||
      x < 18 ||
      x > width - 18 ||
      document.querySelector("dialog[open]") ||
      (event.target as Element).closest(
        "input, textarea, select, [contenteditable], audio, video, .category-filter-pills",
      )
    )
      return;

    this.gesture = {
      pointerId: event.pointerId,
      x,
      y,
      horizontal: false,
      index,
      width,
      pageTop: this.main.getBoundingClientRect().top + window.scrollY,
      offset: 0,
      samples: [{ x, time: event.timeStamp }],
    };
    this.main.style.willChange = "transform";
    this.mountPreviews(this.gesture);
  }

  private drag(event: PointerEvent): void {
    const start = this.gesture;
    if (start?.pointerId !== event.pointerId || this.settlement !== undefined)
      return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.horizontal) {
      const slop = 2;
      if (
        (Math.abs(dy) >= slop && Math.abs(dy) >= Math.abs(dx)) ||
        window.getSelection()?.toString()
      ) {
        this.cleanup();
        return;
      }
      if (Math.abs(dx) < slop || Math.abs(dx) <= Math.abs(dy)) return;

      start.horizontal = true;
      this.main.setPointerCapture(event.pointerId);
      document.body.classList.add("swiping-pages");
      for (const { page } of this.previews) page.style.visibility = "visible";
    }

    this.recordSample(start, event);
    const hasNeighbor = this.links[start.index + (dx < 0 ? 1 : -1)];
    const offset = hasNeighbor
      ? Math.max(-start.width, Math.min(start.width, dx))
      : dx * 0.2;
    this.move(start, offset);
  }

  private end(event: PointerEvent, released: boolean): void {
    const start = this.gesture;
    if (start?.pointerId !== event.pointerId || this.settlement !== undefined)
      return;

    if (!released) {
      this.finish();
      return;
    }

    this.recordSample(start, event);
    const distance = event.clientX - start.x;
    const direction = distance < 0 ? 1 : -1;
    const velocity = this.releaseVelocity(start);
    const travel = Math.abs(distance);
    const speed = velocity * Math.sign(distance);
    const halfway = start.width / 2;
    const flick =
      travel >= 24 && speed >= 0.65 && travel + speed * 180 >= halfway;
    this.finish(travel >= halfway || flick ? direction : undefined, velocity);
  }

  private recordSample(start: Gesture, event: PointerEvent): void {
    const time = event.timeStamp;
    start.samples = start.samples.filter((sample) => time - sample.time <= 100);
    start.samples.push({ x: event.clientX, time });
  }

  private releaseVelocity(start: Gesture): number {
    const first = start.samples[0];
    const last = start.samples.at(-1)!;
    const elapsed = last.time - first.time;
    return elapsed > 0 ? (last.x - first.x) / elapsed : 0;
  }

  private settleMotion(
    start: Gesture,
    target: number,
    velocity: number,
  ): SwipeMotion {
    const distance = target - start.offset;
    if (this.reducedMotion.matches || distance === 0)
      return { duration: 0, easing: "ease-out" };

    const travel = Math.abs(distance);
    const speed = velocity * Math.sign(distance);
    const duration = Math.round(
      Math.max(
        110,
        (175 + 175 * Math.sqrt(travel / start.width)) /
          (1 + Math.max(0, speed) * 0.65),
      ),
    );
    // Give slow releases an ease-out curve and carry faster releases into it.
    const firstControlY = Math.max(
      0.55,
      Math.min(1, (0.25 * speed * duration) / travel),
    );
    return { duration, easing: `cubic-bezier(.25,${firstControlY},.45,1)` };
  }

  private finish(direction?: -1 | 1, velocity = 0): void {
    const start = this.gesture;
    if (!start?.horizontal) {
      this.cleanup();
      return;
    }

    const link = direction && this.links[start.index + direction];
    const target = link && direction ? -direction * start.width : 0;
    const motion = this.settleMotion(start, target, velocity);
    const transition = `transform ${motion.duration}ms ${motion.easing}`;
    this.main.style.transition = transition;
    for (const { page } of this.previews) page.style.transition = transition;
    this.move(start, target, motion);

    const complete = (): void => {
      const previousHash = location.hash;
      link?.click();
      if (location.hash === previousHash) this.cleanup();
    };
    const fallback = motion.duration > 0 ? motion.duration + 50 : 0;
    this.settlement = {
      complete,
      timer: window.setTimeout(complete, fallback),
    };
  }

  public dispose(): void {
    this.lifecycle.dispose();
    this.observer.disconnect();
    this.cleanup();
  }
}

export function initializeNavigation(
  dependencies: TabNavigationDependencies,
): () => void {
  const navigation = new TabNavigation(dependencies);
  return () => navigation.dispose();
}
