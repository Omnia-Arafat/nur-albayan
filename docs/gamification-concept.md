# Nur Al-Bayan: Gamification Concept and Intention

Extracted from `Omnia-Arafat/nur-albayan-pages` (master, as of 2026-10-06), the code behind nur-albayan-pages.vercel.app. File references point at that repo.

## 1. Intention

**What it is.** Every page (6 to 95) of the printed *Nur Al-Bayan* textbook, the classic graded method for learning to read Arabic and the Quran, becomes an interactive lesson. The printed page stays the curriculum; the app adds drilling, play, and tracking around it.

**Who it serves.**
- **The teacher or parent** runs the session. They show the card, the child reads aloud, and the adult grades "Correct" or "Try again". The guide calls itself "a quick reference for the teacher and parent: start a session, follow the student, treat the stumbles" (`guide.html`).
- **The child** reads, earns points and stars, and gets short game breaks.
- A **classroom of children**: a roster of student profiles with avatars, one active student at a time, plus a guest mode for quick trials.

**Teaching goals.**
1. Correct reading in strict curriculum order: letters and shapes, harakat, madd (alif, yaa, waw), shaddah and tanween, tajweed rules, then Quranic and dictation orthography with a final review (9 stages on `index.html`).
2. Faithful Quranic script: KFGQPC Uthmani font on Quran pages, and color tokens that highlight the target sound (red for the target vowel or madd, blue for contrasts and qalqalah).
3. Nothing a child stumbles on is lost. Every miss goes to a personal **mistake bank** and is drilled until mastered.
4. The adult's judgment stays the authority. "The games are a practice tool after reading, not a replacement for the teacher's assessment" (`guide.html` §5). Color never alone signals right or wrong.

**Product principles.** Offline-first PWA, no server, all data in the browser (privacy), Arabic and English with equal coverage, accessibility baseline (keyboard, screen-reader announcements, 44px targets, reduced motion and sound toggles).

## 2. The core loop

```
Pick student (or guest) → open lesson → read the rule
   → card by card: child reads, adult grades ✓ / ✗
        (optional game break at 1/3, 2/3, end)
   → Wordwall room (7 game modes over the same words)
   → Finish: score, accuracy, stars, chart
   → "Review today's mistakes" drill
   → misses persist in the mistake bank → Remediation lesson
```

The result counts toward the student's total only when the lesson is finished (`shared/lesson-summary.js`).

## 3. Scoring mechanics

### Card types (`t` field on each word card)

Every word card carries a game category. Across pages 6-95 there are about 875 normal, 414 golden, 402 speed and 238 danger cards.

| Type | Correct | Wrong (default) | Wrong (no-penalty mode) | Intent |
|---|---|---|---|---|
| normal | +2 | −2 | 0 | Baseline practice |
| golden ⭐ | +10 | −2 | 0 | Key word for the rule, big reward |
| speed ⏱ | +5 if the timer is still running, else +2 | −2 | 0 | Fluency (default timer 10s, adjustable 3 to 60s) |
| danger ⚠️ | +2 | −5 with a warning | 0, shows "High focus!" | Easily misread words: careful attention |

The score never drops below 0. Source: `shared/lesson-session.js` `evaluate()`.

### Wordwall and other points
- Revealing and grading a word in the Wordwall room: +5 correct, 0 wrong (`shared/app.js` `gradeResult`).
- Ladder: +2 per rung, +5 bonus for reaching the top.
- Remediation lesson: +2 per correct, +5 when the word becomes mastered.

### Stars and accuracy
At the end, accuracy = correct ÷ attempts. Stars: **3 at 90% or above, 2 at 70% or above, otherwise 1**. A lesson's stars only ever go up.

### Repeat policy (teacher setting)
When a lesson is repeated, the teacher chooses what counts:
- **Best**: highest score so far (default)
- **Latest**: the last completed attempt
- **Cumulative**: every attempt adds up (rewards repetition)

`totalScore` is the sum of lesson records only. Remediation rewards are deliberately excluded (`shared/student-progress.js`, README).

### Feedback
Correct answers get a random cheer ("Excellent! 🌟", "Perfect! 🏆", "Magnificent! ❤️⭐", ⭐⭐⭐⭐⭐) with color and sound. Misses get a gentle "Needs practice ⭐" and a soft fail tone; even failure messages carry a star. Wins trigger a confetti celebration and chime.

## 4. Game layer

### A. Game breaks (optional, off by default)
Placed at one third, two thirds, and the end of the card deck, each introduced by a transition screen:
1. **Tic-Tac-Toe (XO)**
2. **Connect 4**
3. **Memory Match** (emoji pairs), or **Riddles** when a page sets `game3: 'riddles'`. The 8 riddles are about harakat, madd, tanween and short surahs, and finishing all of them awards the "Nur Al-Bayan Genius" badge. No page currently enables Riddles.

The board games offer **vs Computer** or **with the Teacher** mode, and an **Easy** (random) or **Smart** (tactical) AI (`shared/game-ai.js`). They are pure breaks: no lesson points. A "Continue reading 📖" button returns to the next card.

### B. Wordwall room (7 modes over the lesson's own words)
After the last card, the same words are replayed as games (`shared/games-wordwall.js`):

| Mode | Mechanic |
|---|---|
| Boxes | Numbered boxes; open one to reveal a word, then grade it |
| Curtain | Same as Boxes, with a theatre-curtain reveal |
| Wheel | Spin a wheel of fortune; it lands on a word |
| Cards | Deal from a shuffled deck, one at a time |
| **Ladder** ("Quranic Ascension Ladder") | Choose 5 or 10 rungs. Correct = climb one rung (+2), wrong = slip one rung down and the word returns to the end of the queue. Reaching the top shows 👑 "Ma sha Allah! You reached the peak!" (+5) |
| Tiles | 3D flip tiles revealing words |
| Honeycomb | Hex grid of the words. Each cell becomes ✔ mastered or 📌 review, with a "Mastered: X of N" badge |

A **"today's mistakes only"** toggle limits any Wordwall mode to the words missed this session, so the games become targeted review.

## 5. Mistake bank and mastery

- Every wrong answer (cards, ladder, Wordwall) records the word against the student with lesson id, miss count and timestamp (`shared/mistake-bank.js`).
- **In-session review.** The summary screen offers "🔄 Review today's mistakes 🎯" in one of three modes:
  - **Loop**: a missed word goes to the back of the queue until it is read right (default).
  - **Single pass**: one pass through the list.
  - **Instant repeat**: after a miss, the child must read the same word correctly 3 times in a row ("Well done! (1/3) ⭐").
- **Cross-lesson remediation.** The first item on the index is a Remediation lesson that pulls the active student's bank. A word counts as **mastered after 2 consecutive correct reads** and then leaves the bank. A new miss resets its streak.

## 6. Student roster and progress

- Student profiles with a name and an avatar (👦 👧 🦁 🦅 👑 🚀 🦄 🏆 ...). Profiles can be edited and deleted; guest mode saves nothing.
- Each lesson record holds score, best, latest and cumulative score, accuracy, stars, attempts and last studied date.
- The index shows ⭐ stars and points on every lesson card for the active student, which works as the progression map.
- The student profile and a printable report show completed lessons with stars, accuracy, total score and the mistake-bank words grouped by lesson. A doughnut chart (with a text fallback) shows correct vs incorrect.
- JSON export and import for backup and moving between devices.

## 7. Teacher controls (settings)

Sound and volume, game breaks on or off, default game mode (computer or teacher) and difficulty, speed timer length, shuffle cards, **no-penalty mode**, manual advance, remediation drill mode, repeat-grading policy, font, text size, and light or dark theme.

## 8. Design notes to carry forward

What makes the concept work:
- **Adult-in-the-loop grading.** No speech recognition; the teacher is the judge, and the app is a scoreboard and motivator.
- **One word set, many games.** Every game reuses the lesson's own cards, so play is still reading practice.
- **Loss without humiliation.** Penalties are small, a no-penalty mode exists, the score floors at 0, and failure copy stays encouraging.
- **Mistakes become content.** The mistake bank feeds the drills, the Wordwall filter and the remediation lesson.
- **Islamic framing of rewards.** The ladder to "the peak" with 👑 and *ma sha Allah*, riddles about surahs, and the "Genius of Nur Al-Bayan" badge.

Gaps and inconsistencies I noticed in the current code, worth deciding on in a rebuild:
- Point values differ by surface: a correct card earns +2, but the same word graded in the Wordwall earns +5, and the ladder's +5 peak bonus never reaches the student record.
- No cross-student leaderboard, streaks, daily goals or badges collection. Stars per lesson are the only persistent reward.
- Game breaks are off by default and give no points, so many users may never see them.
- The Riddles game exists but no page turns it on, and its 8 questions are fixed rather than tied to the page.
- Progress lives in one browser, so a teacher with several devices must export and import JSON.
