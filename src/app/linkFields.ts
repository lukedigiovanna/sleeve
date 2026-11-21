import { linkRow } from "../components/formFields";
import type { ExternalLink } from "../types/albums";
import { focusForTyping } from "./device";
import type { EditorDialog } from "./editorContracts";
import { musicLinkSubmissionSchema } from "./formValidation";
import { makeId } from "./id";

export function readLinkFields(
  form: HTMLFormElement,
  formError: EditorDialog["formError"],
  existing?: readonly ExternalLink[],
): ExternalLink[] | undefined {
  const links: ExternalLink[] = [];
  const seen = new Set<string>();

  for (const row of form.querySelectorAll(".link-fields")) {
    const input = row.querySelector<HTMLInputElement>('[name="linkUrl"]')!;
    const url = input.value.trim();
    const label = row
      .querySelector<HTMLInputElement>('[name="linkLabel"]')!
      .value.trim();
    if (!url && !label) continue;

    const parsed = musicLinkSubmissionSchema.safeParse({ url, label });
    if (!parsed.success) {
      const subject = existing ? "link" : "music link";
      formError(`Enter an HTTP or HTTPS URL for each ${subject}.`, input);
      return undefined;
    }
    if (existing && seen.has(url)) {
      formError("Each link must have a different URL.", input);
      return undefined;
    }

    seen.add(url);
    const previous = existing?.find((link) => link.url === url);
    links.push({ id: previous?.id ?? makeId(), ...parsed.data });
  }

  return links;
}

export function handleLinkFieldAction(button: HTMLButtonElement): boolean {
  const form = button.form;
  if (!form) return false;

  switch (button.dataset.action) {
    case "add-link": {
      const rows = form.querySelector("#link-rows");
      if (!rows) return false;

      rows.insertAdjacentHTML("beforeend", linkRow());
      focusForTyping(
        rows.lastElementChild?.querySelector<HTMLInputElement>("input"),
      );
      return true;
    }
    case "remove-link":
      button.closest(".link-fields")?.remove();
      form.querySelector<HTMLElement>('[data-action="add-link"]')?.focus();
      return true;

    default:
      return false;
  }
}
