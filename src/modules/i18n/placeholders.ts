/** The {placeholders} a text uses, so a translation can be checked for the same ones. */
export const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
