import { escapeHtml } from "../components/html";
import { icon } from "../components/icons";

export class Toast {
  private readonly element: HTMLElement;
  private readonly home: HTMLElement;
  private readonly observer: MutationObserver;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(element: HTMLElement) {
    this.element = element;
    this.home = element.parentElement!;
    this.observer = new MutationObserver((records) => {
      if (
        !this.element.isConnected ||
        records.some(
          (record) =>
            record.type === "attributes" &&
            record.target instanceof HTMLDialogElement,
        )
      )
        this.showAboveDialogs();
    });
  }

  announce(message: string): void {
    clearTimeout(this.timer);

    this.showAboveDialogs();
    this.element.innerHTML = /* HTML */ `${icon("check", 17)}<span
        >${escapeHtml(message)}</span
      >`;
    this.observer.observe(this.home, {
      subtree: true,
      childList: true,
      attributeFilter: ["open"],
    });
    this.timer = setTimeout(() => this.dismiss(), 3800);
  }

  private showAboveDialogs(): void {
    // Keep the live region in the active modal so it remains accessible.
    // The manual popover paints above the modal and outside its scroll area.
    const dialogs = this.home.querySelectorAll("dialog:modal");
    const host = dialogs[dialogs.length - 1] ?? this.home;
    if (this.element.parentElement !== host) host.append(this.element);
    if (!this.element.matches(":popover-open")) this.element.showPopover();
  }

  private dismiss(): void {
    this.observer.disconnect();
    if (this.element.matches(":popover-open")) this.element.hidePopover();
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.dismiss();
  }
}
