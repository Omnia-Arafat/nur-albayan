/** CSS custom property for a token key: color.pill.yellow.fill → --nb-color-pill-yellow-fill. */
export const cssVar = (tokenKey: string) => `--nb-${tokenKey.replace(/[._]/g, "-")}`;

type Token = { key: string; value: string };
type Font = { role: string; family: string; fallbacks: string };
type Role = { key: string; tokenKey: string };

const safeValue = (v: string) => {
  if (/[;{}<>]/.test(v)) throw new Error(`Unsafe token value: ${v}`);
  return v;
};

/**
 * Compile a theme's tokens, default fonts and teaching roles into one :root rule.
 * Components only ever read these variables (through the Tailwind theme in globals.css).
 */
export function compileThemeCss(tokens: Token[], fonts: Font[], roles: Role[], selector = ":root"): string {
  const lines = [
    ...tokens.map((t) => `${cssVar(t.key)}:${safeValue(t.value)}`),
    ...fonts.map((f) => `--nb-font-${f.role}:${safeValue(`'${f.family.replace(/'/g, "")}', ${f.fallbacks}`)}`),
    ...roles.map((r) => `--nb-role-${r.key}:var(${cssVar(r.tokenKey)})`),
  ];
  return `${selector}{${lines.join(";")}}`;
}
