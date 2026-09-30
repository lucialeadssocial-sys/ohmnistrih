/**
 * KROK 27 — zobrazenie položky voľnej knižnice pre rozhranie.
 *
 * Prečo zvlášť: rozhranie musí pri každom obrázku **viditeľne** povedať licenciu
 * a či treba uviesť autora. Keby to bolo schované, človek by použil obrázok,
 * ktorý sa do videa nesmie alebo bez povinného priznania.
 */

import type { LibraryItem } from "./freeLibrary";

export interface LibraryViewItem extends LibraryItem {
  /** Riadok pre človeka: autor · licencia · či treba uviesť autora. */
  rowSk: string;
  /** Krátke upozornenie, keď je priznanie povinné (inak `null`). */
  warningSk: string | null;
}

export function librariesItemRowSk(item: LibraryItem): string {
  const creator = item.creator || "neznámy autor";
  const size = item.width > 0 && item.height > 0 ? `${item.width}×${item.height}` : "veľkosť neznáma";
  const license = `${item.license.toUpperCase()} ${item.licenseVersion}`.trim();
  return `${creator} · ${license} · ${size}`;
}

export function libraryViewItem(item: LibraryItem): LibraryViewItem {
  return {
    ...item,
    rowSk: librariesItemRowSk(item),
    warningSk: item.attributionRequired ? "Povinné: uveď autora v popise videa." : null,
  };
}

export function libraryViewItems(items: LibraryItem[]): LibraryViewItem[] {
  return items.map(libraryViewItem);
}
