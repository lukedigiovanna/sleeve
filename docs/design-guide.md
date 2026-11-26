# Sleeve design guide

Sleeve is a personal listening journal and a curated music catalog. The interface
should feel editorial and precise, giving artwork, names, and listening notes room
while making records easy to browse, compare, and maintain.

## Hierarchy and layout

- Lead detail pages with the record's name or title. Use the shared serif
  heading style and let long names wrap at a comfortable reading width.
- Group supporting metadata below the title. On an artist page, the portrait,
  country, and external links form one compact profile row. Let metadata reflow
  within that row on narrow screens.
- Use space and alignment to establish reading order. Repeat the same layout
  and metadata order across catalog entries so they are easy to scan.
- Give artwork a consistent footprint. Keep a simple fallback for records
  without an image and omit optional metadata when it is unavailable.

## Catalog interaction

- Keep the layout switcher close to the list it controls. On artist pages it
  can share the profile row so the albums start directly below. Keep editing
  actions secondary to the record itself.
- Use recognizable icons for compact controls and give each one an accessible
  name and keyboard focus state. Name country flags for assistive technology
  and show what the flag opens on hover and keyboard focus.
- Let linked metadata lead to a meaningful view of the collection. For example,
  an artist's country opens the Library filtered to that country.
- Use the shared typography, color tokens, and controls across themes. Check
  layouts with long names, missing metadata, and narrow screens.
