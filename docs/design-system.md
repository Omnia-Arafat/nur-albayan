# Nur Al-Bayan Book: Design System

Extracted from the printed book scan (`nur-albayan-book.pdf`, 98 pages, 5th edition, compiled by Mohamed Hassan Mohamed / Tarek El-Saeed). Sample page renders and contact sheets of every page are in book-samples (project files).

**How the values were obtained.** The PDF is a scan with no text layer and no embedded fonts. Font names below are identified by eye and are not confirmed. Hex values were measured from the scan's pixels (median of each color cluster), so treat them as close approximations of the print colors, not exact Pantone matches.

**Page numbering.** PDF page N is printed book page N−1. All page numbers in this doc are the printed book's.

---

## 1. Identity in one paragraph

A bright, friendly, child-oriented Egyptian schoolbook. Every page sits on warm cream paper, and every learning item lives inside a soft rounded "pill" with a pastel fill and a slightly darker outline of the same hue. Rows of pills cycle through pastel colors (yellow, sky, pink, green). The Arabic is huge, fully voweled, and color-coded letter by letter: red marks what is being taught, blue and black separate the neighbors. Headings are a heavy red display face. Small tags in the top corners say where you are (unit, lesson, "read and observe"), and a teacher note in small bold type runs along the bottom.

## 2. Color

### 2.1 Paper and neutrals
| Token | Hex | Use |
|---|---|---|
| `paper` | `#FEFBDA` (range `#FDFDE1` to `#FFFEEB`) | Page background: warm cream, never pure white |
| `surface` | `#FFFFFF` | Inside picture cards and some pills |
| `ink` | near-black, about `#1E1B1A` | Base Arabic text, teacher-note body |
| `ink-muted` | about `#6B6B6B` | Divider lines inside segmented pills |

### 2.2 Ink colors (text and marks)
| Token | Hex | Role |
|---|---|---|
| `red` (primary) | `#ED425B` | Target letter, haraka, madd or rule. Page titles. "For the teacher and parents:" label |
| `red-warm` | `#E35C4E` | Lesson tag ribbon, page-number pill outline |
| `blue` | `#3D68CA` | Second color in segmented drills, contrast syllables |
| `magenta` | `#DE5698` | Alphabet letters, emphasis in notes |
| `purple` | `#A3248F` | Subtitles ("drill (2) Quranic examples"), alphabet letters |
| `purple-deep` | `#4C1889` | Cover subtitle, unit tag |
| `teal` | `#25A792` | "Read and observe" tag, alphabet letters |
| `green` | `#2CA775` | Footer band, tajweed sub-headings |
| `cyan` | `#31ABD4` | Some tags and frames |
| `orange` | `#E09D5E` | Accents in illustrations and frames |
| `yellow` | `#FFFA58` | Highlights, illustrations |

### 2.3 Pastel pill fills (with an outline of the same hue)
| Token | Fill | Typical outline |
|---|---|---|
| `pill-yellow` | `#FDFCCD` | olive or gold |
| `pill-peach` | `#FBE5CC` | tan or brown |
| `pill-sky` | `#D5F4F8` | cyan or blue |
| `pill-mint` | `#DBF8F5` | teal |
| `pill-lime` | `#EEFCDC` | green |
| `pill-pink` | `#F5D7F0` | magenta |
| `pill-rose` | `#FACCE5` | pink |
| `pill-lavender` | `#E8DCF3` | purple |
| `pill-salmon` | `#FCD5CC` | red |

**Row rhythm.** On drill pages, pills share a color by row band, usually two rows per color in the cycle yellow → sky → pink → green (book p. 9) or peach → sky → pink → green (p. 25). Color here only groups rows; it carries no meaning.

## 3. Pedagogical color coding (the "grammar" of color)

This is the most important part of the system, and the app already copies it (`CONTEXT.md` semantic tokens).

| Color | Meaning | Example |
|---|---|---|
| **Red** | The thing being taught on this page: the target haraka (fatha, kasra, damma), the madd letter, sukun, tanween, shaddah, or the diacritic shape in rasm tables | p. 25 note: "read the word through the red segments (ءا) then the black (دَمُ)" |
| **Blue** | The neighboring syllable or letter, so the eye can split the word. Also qalqalah letters | p. 9: letters alternate red, blue, black inside each segmented word |
| **Black** | Neutral base letters | everywhere |
| **Purple / magenta** | Secondary distinctions: names in stories, headings inside boxes, notes | p. 38: «سامي» in purple, «يوسف» in red |
| **Green** | Rule names and structural labels in tajweed sections | p. 80 sub-headings |

On the alphabet page (p. 2) each letter has its own color (purple, teal, magenta, olive, black). That is decorative variety, not coding.

## 4. Typography

| Role | Look | Closest digital match (inferred) |
|---|---|---|
| **Book logo** «نور البيان» | Red brush calligraphy with a dark outline and drop shadow | Custom lettering; not a font |
| **Page title** (e.g. «حركة الفتح») | Heavy, rounded display Arabic in red, about 2× the drill size | A heavy display face such as Hacen or a similar bold geometric Naskh-Kufi |
| **Subtitle / drill label** («تدريب (٢) أمثلة قرآنية») | Bold, smaller, purple; the drill number in parentheses | Same family, bold |
| **Corner tags** | White bold text on colored ribbons | Bold sans Arabic |
| **Alphabet glyphs** (p. 2) | Very heavy, rounded, simplified letterforms | Display sans (similar to Hacen Promoter or Tajawal Black) |
| **Drill letters and words** | Large, bold, fully voweled Naskh, about 28 to 36 pt in print | Noto Naskh Arabic Bold, or Amiri Bold |
| **Quranic text** (pp. 79+) | Uthmani Madinah-mushaf orthography: small madd signs, dagger alif, waslah, Quranic sukun | KFGQPC Uthmanic Hafs (what the app already uses) |
| **Dictation / stories** | Standard Naskh with full tashkeel and modern spelling | Noto Naskh Arabic |
| **Teacher notes** (footer) | Small bold sans; the label «للمعلم والآباء:» in red, key words in red or green | Bold sans Arabic (Simplified Arabic Bold style) |
| **Page number** | Arabic-Indic digits (٢٥) in a red-outlined pill | |

**Scale (relative).** Title 1.6 to 2.0 × drill text, subtitle 0.7 ×, drill text 1.0, story text 0.8 to 0.9 ×, teacher note 0.4 ×.

**Rules.** Tashkeel is always present. Arabic-Indic digits are used throughout. The book sets Quranic text and dictation text in different scripts, and the rasm pages (pp. 89 to 95) put them side by side for comparison.

## 5. Visual grammar (symbols and operators)

| Mark | Meaning | Where |
|---|---|---|
| Vertical dividers inside a pill | One cell per letter, for spelling letter by letter | pp. 6 to 9, 14, 18 |
| `ـ` connectors with spaces (`بـ ـبـ ـب`) | Letter positions: initial, medial, final | p. 6 «مواضع الحروف» |
| ` - ` separator | Compare variants within one item (`بَ - بِ - بُ`) | comparison drills |
| `←` arrow | Derivation, short to long (`قَمَ ← قَامَ`), or syllable to word | madd drills, p. 28 |
| `=` | Sound equivalence (`بَنْ = بًا`) | tanween lessons |
| `( ـْ )` red in parentheses under an example | Isolates the diacritic shape being compared | rasm table p. 89 |
| `تدريب (n)` with horizontal rules either side | Section break between drills on a page | p. 48 |
| Small Quranic ayah marker ۝ | End of verse in Quranic examples | p. 89 |

## 6. Layout and page structure

**Format.** Portrait, 460 × 667 pt (about 16.2 × 23.5 cm). Margins are about 6% on the sides and about 8% top and bottom. Content is RTL.

**Header (on every lesson page):**
- Top right: a **unit tag** (purple or plum ribbon, «الوحدة الأولى») on the first page of a unit, then a **"read and observe" tag** (teal or green ribbon, «اقرأ ولاحظ»).
- Top left: a **lesson tag** (red ribbon with an angled end, «الدرس الأول» ...).
- Center: the **title** in red, with a purple **subtitle** below it.

**Body.** One of these module types:
1. **Picture-word grid** (pp. 3 to 5): 3 × 3 rounded cards. Each card has a photo, the word with the target letter in red, and a vertical strip of the letter in three positions. A strip of pink pill rows for the letter review sits at the bottom.
2. **Letter tile grid** (p. 2): 5 columns of rounded squares, big glyph on white, letter name on a pastel band.
3. **Segmented pill rows** (pp. 6 to 24): 3 pills per row, each split into letter cells.
4. **Word pill rows** (pp. 25 onward): 5 per row for short words, 3 for longer, 2 for phrases.
5. **Sentence pills**: full width, with an optional small clip-art icon at the start (p. 48).
6. **Story or reading box** (pp. 38, 61, 69, 74, 95): a large rounded card with a thick colored border (pink, cyan), a title in purple, illustrated characters, and lines of fully voweled text.
7. **Rule tables** (tajweed pp. 79 to 87; rasm pp. 89 to 95): a colored label column (letter or rule name) plus example cells. Each table row is its own pastel pill.
8. **Rule definitions**: bold paragraph with the rule name in red, then a colon and the definition.

**Footer:**
- A teacher note: «للمعلم والآباء:» in red, then instructions, sometimes «هام جداً» or «تنبيه». It often points back to earlier pages for daily review ("صفحة ٦، ٧").
- A page number in a red-outlined pill, centered.
- A green band carrying third-party distributor logos (OsraWay.com, Cryp2Day). Leave these out of any app.

**Spacing.** Gutters between pills are about one third of the pill height. Corner radius is about 25 to 35% of the pill height, so the shapes read as very soft. Rows are evenly distributed to fill the page.

## 7. Shape and component vocabulary

| Component | Spec |
|---|---|
| **Pill** | Pastel fill, 1.5 to 2 px outline of the same hue at about 50% saturation, large radius, a slight inner highlight |
| **Segmented pill** | A pill with thin grey vertical dividers, one cell per letter |
| **Card with image** | White inside, sky-blue rounded frame, image on top, word below |
| **Ribbon tag** | Solid color, white bold text, one angled or flagged end |
| **Story box** | Wide rounded rectangle, thick (3 to 4 px) colored border, light tint inside, clip-art on the side |
| **Page number pill** | Small oval, red outline, Arabic-Indic digits |
| **Section rule** | Thin purple horizontal lines with the drill label centered between them |

## 8. Imagery and iconography

- **Picture-word photos** (pp. 3 to 5): realistic cut-out photos on white (dates, house, camel, sheep, Al-Aqsa mosque, fridge). Each one illustrates a word that starts with the target letter.
- **People**: cartoon clip-art of children and families in modest Islamic dress, praying, reading, visiting the sick, giving. These carry the values in the stories (prayer, zakat, fasting, hajj, kindness to parents).
- **Cover**: open mushaf showing «اقرأ باسم ربك» and «ورتل القرآن ترتيلا», a globe on green grass with flowers, a sky gradient, and red calligraphic «نور البيان» with a purple subtitle «لتعليم القراءة وترتيل القرآن». The audience appears on the cover: kindergartens, weak readers at school, Quran memorization centers, literacy classes, Arabs and non-Arabs.
- Decorative ornaments are minimal inside the book. The intro page has a floral (rose) border.

## 9. Mapping to the current app

The app at nur-albayan-pages already follows the book's color semantics and font split:

| Book | App today (`shared/css/typography.css`, `cards.css`) | Note |
|---|---|---|
| red `#ED425B` | `.c-red` `#DC2626` | App red is darker and more orange. Use the book value for fidelity |
| blue `#3D68CA` | `.c-blue` `#1D4ED8` | App blue is more saturated |
| black | `.c-black` `#090D16`, weight 800 | Close |
| purple `#A3248F` | `.c-purple` `#7E22CE` | Book purple is more magenta |
| pastel pills | `theme-emerald / pink / amber / blue / purple` | Same idea. The book also has yellow, peach, mint and lime fills |
| Uthmani for Quran, Naskh for dictation | KFGQPC Uthmanic Hafs, Noto Naskh Arabic, Amiri | Matches |
| cream paper `#FEFBDA` | Not checked | Worth adopting as the base background |

## 10. Suggested tokens (CSS)

```css
:root {
  /* paper & ink */
  --nb-paper: #FEFBDA;
  --nb-surface: #FFFFFF;
  --nb-ink: #1E1B1A;
  /* teaching colors */
  --nb-target: #ED425B;     /* red: what is being taught */
  --nb-contrast: #3D68CA;   /* blue: neighbour syllable */
  --nb-secondary: #A3248F;  /* purple: names, subtitles */
  --nb-rule: #2CA775;       /* green: rule labels */
  /* tags */
  --nb-tag-lesson: #E35C4E;
  --nb-tag-observe: #25A792;
  --nb-tag-unit: #4C1889;
  /* pill fills */
  --nb-pill-yellow: #FDFCCD;  --nb-pill-peach: #FBE5CC;
  --nb-pill-sky: #D5F4F8;     --nb-pill-mint: #DBF8F5;
  --nb-pill-lime: #EEFCDC;    --nb-pill-pink: #F5D7F0;
  --nb-pill-rose: #FACCE5;    --nb-pill-lavender: #E8DCF3;
  /* type */
  --nb-font-quran: 'KFGQPC Uthmanic Hafs', 'Amiri Quran', serif;
  --nb-font-naskh: 'Noto Naskh Arabic', 'Amiri', serif;
  --nb-font-display: 'Tajawal', 'Cairo', sans-serif; /* heavy weights for titles and tags */
  --nb-radius-pill: 999px;   /* or ~30% of height for squarer pills */
}
```

The display font is a suggestion: the book's heading face could not be identified from the scan. A dark mode needs its own pastel set. The book only exists on cream paper, so dark-mode values have to be designed, not extracted.
