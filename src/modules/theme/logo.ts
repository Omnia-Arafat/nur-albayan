import { type IconSet, iconSvg } from "./icons";

/**
 * The app's logo as standalone SVG: the header's tile (yellow pill, purple outline) with the book icon,
 * coloured from token values. `maskable` fills the whole square so launchers can crop it to any shape.
 */
export function logoSvg(set: IconSet, value: (tokenKey: string) => string, opts: { maskable?: boolean } = {}) {
  const size = 512;
  const inset = opts.maskable ? 0 : 24;
  const radius = opts.maskable ? 0 : 150;
  const border = opts.maskable ? 0 : 18;
  const icon = opts.maskable ? 260 : 320;
  const at = (size - icon) / 2;
  const tile = `<rect x="${inset + border / 2}" y="${inset + border / 2}" width="${size - 2 * inset - border}" height="${size - 2 * inset - border}" rx="${radius}" fill="${value("color.pill.yellow.fill")}" stroke="${value("color.purple.deep")}" stroke-width="${border}"/>`;
  const glyph = iconSvg(set, "book", { size: icon, resolve: value }).replace("<svg ", `<svg x="${at}" y="${at}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${tile}${glyph}</svg>`;
}
