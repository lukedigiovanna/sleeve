import { isLibraryRoute } from "./libraryUrl";

const catalogHashes = ["#artists", "#genres", "#instruments"] as const;

interface Panel {
  hash: string;
  element: HTMLElement;
}

export class MobileTabPanels {
  public readonly media = window.matchMedia("(max-width: 700px)");
  private readonly host = document.createElement("div");
  // Keep inactive panels connected but outside the live document's selectors.
  private readonly parking = this.host.attachShadow({ mode: "closed" });
  private readonly panels = new Map<string, Panel>();
  private readonly scrollPositions = new Map<string, number>();
  private readonly ids = new WeakMap<HTMLElement, Map<Element, string>>();
  private readonly libraryLink = document.querySelector<HTMLAnchorElement>(
    '.main-nav [data-nav="library"]',
  );
  private libraryHash = "";
  private cancelWarmup: (() => void) | undefined;

  constructor(renderList: (hash: string, root: HTMLElement) => void) {
    this.renderList = renderList;
    this.host.hidden = true;
  }

  private readonly renderList: (hash: string, root: HTMLElement) => void;

  private key(hash: string): string {
    return isLibraryRoute(hash) ? "" : hash;
  }

  public supports(hash: string): boolean {
    return (
      isLibraryRoute(hash) || catalogHashes.some((catalog) => catalog === hash)
    );
  }

  private conceal(panel: HTMLElement): void {
    const ids = new Map<Element, string>();
    for (const element of panel.querySelectorAll("[id]")) {
      ids.set(element, element.id);
      element.removeAttribute("id");
    }
    this.ids.set(panel, ids);
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "frame swipe-preview";
    panel.inert = true;
    panel.setAttribute("aria-hidden", "true");
    return panel;
  }

  public renderPreview(hash: string): HTMLElement {
    const panel = this.createPanel();
    this.renderList(hash, panel);
    this.conceal(panel);
    return panel;
  }

  public rememberLibrary(hash: string): void {
    if (!isLibraryRoute(hash)) return;

    this.libraryHash = hash;
    this.updateLibraryLink();
  }

  private updateLibraryLink(): void {
    if (this.libraryLink)
      this.libraryLink.href = (this.media.matches && this.libraryHash) || "#";
  }

  public prepare(hash: string): HTMLElement {
    const key = this.key(hash);
    const cached = this.panels.get(key);
    if (cached?.hash === hash) return cached.element;

    const panel = this.renderPreview(hash);
    this.store(hash, panel);
    return panel;
  }

  private store(hash: string, element: HTMLElement): void {
    const key = this.key(hash);
    this.panels.get(key)?.element.remove();
    this.panels.set(key, { hash, element });
    if (!this.host.isConnected) document.body.append(this.host);
    this.parking.append(element);

    // Hidden panels cannot rely on viewport-based lazy loading.
    const firstImages = [...element.querySelectorAll("img")].slice(0, 16);
    for (const image of firstImages) {
      if (image.loading === "lazy") image.loading = "eager";
    }
  }

  public restorePreview(hash: string, element: HTMLElement): void {
    if (this.panels.get(this.key(hash))?.element === element)
      this.parking.append(element);
    else element.remove();
  }

  public saveScroll(hash: string, scroll: number): void {
    if (this.supports(hash)) this.scrollPositions.set(this.key(hash), scroll);
  }

  public scrollFor(hash: string): number {
    return this.supports(hash)
      ? (this.scrollPositions.get(this.key(hash)) ?? 0)
      : 0;
  }

  public leave(hash: string, main: HTMLElement): void {
    if (!this.supports(hash)) return;

    const panel = this.createPanel();
    panel.append(...main.childNodes);
    this.conceal(panel);
    this.store(hash, panel);
  }

  public show(hash: string, main: HTMLElement): void {
    const panel = this.prepare(hash);
    this.panels.delete(this.key(hash));
    main.replaceChildren(...panel.childNodes);
    for (const [element, id] of this.ids.get(panel) ?? []) element.id = id;
    this.ids.delete(panel);
    panel.remove();
  }

  public warm(activeHash: string): void {
    this.cancelWarmup?.();
    this.cancelWarmup = undefined;
    if (!this.media.matches) return;

    const hashes = [this.libraryHash, ...catalogHashes].filter(
      (hash) =>
        this.key(hash) !== this.key(activeHash) &&
        this.panels.get(this.key(hash))?.hash !== hash,
    );

    const schedule = (): void => {
      const hash = hashes.shift();
      if (hash === undefined) return;

      const warmNext = (): void => {
        this.cancelWarmup = undefined;
        this.prepare(hash);
        schedule();
      };
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(warmNext, { timeout: 300 });
        this.cancelWarmup = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(warmNext, 0);
        this.cancelWarmup = () => window.clearTimeout(id);
      }
    };
    schedule();
  }

  public resize(activeHash: string): void {
    this.updateLibraryLink();
    if (this.media.matches) this.warm(activeHash);
    else this.invalidate();
  }

  public invalidate(): void {
    this.cancelWarmup?.();
    this.cancelWarmup = undefined;
    for (const { element } of this.panels.values()) element.remove();
    this.panels.clear();
    this.host.remove();
  }
}
