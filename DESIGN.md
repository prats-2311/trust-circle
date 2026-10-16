# Trust Circle design

## Direction

Calm, plain and trustworthy, for an older person under pressure and the family helping them. One decision per screen. Large type, high contrast, generous spacing. The product slows a scam down; the interface should feel unhurried.

Reading: a trust-first consumer finance app for older adults and their families. Variance 4, motion 3, density 3.

## Type

Atkinson Hyperlegible Next (Braille Institute, designed for low-vision readers), weights 400, 500, 700, 800.

| Role | Size / line height | Weight |
|---|---|---|
| Display (landing) | clamp(40px, 5.2vw, 68px) / 1.04 | 800 |
| Screen title (h1) | 30 to 32px / 1.15 | 800 |
| Section (h2) | 19 to 20px / 1.3 | 700 |
| Body large | 18 to 19px / 1.45 | 400 |
| Body | 17px / 1.4 | 400 |
| Small (never below) | 16px / 1.4 | 400 |
| Amounts | tabular numerals, 800 |

## Colour

| Token | Hex | Use |
|---|---|---|
| ground | #F4F6F4 | page background |
| surface | #FFFFFF | cards, inputs |
| ink | #14201B | text, secondary button borders |
| ink-2 | #3F4B46 | supporting text |
| ink-3 | #4A5651 | captions, hints |
| line / line-strong | #D9DFDB / #B9C4BE | dividers / input borders |
| evergreen (accent) | #1E5A47, dark #14402F, tint #E3EDE8 | primary actions, safe outcomes |
| held | #2C5C8F, ink #24456B, tint #E6EEF7, track #DCE3EC | anything on hold |
| caution | tint #FBF0DC, ink #6E4300 | warnings that ask for a pause |
| blocked | #A2302A, ink #8A231E, tint #F8E5E3 | stopping actions, scam verdicts |
| neutral tint | #EEF1EF | not checked, hold ended |

Status is always a word plus an icon. Colour is never the only signal.

## Shape, spacing, elevation

- Radius: 14px for controls (buttons, inputs, notices); 20px for panels (cards); 999px for chips and avatars.
- Spacing: a 4px grid. Screens use 24px side padding, with 16 to 28px between groups.
- Elevation: none on screens (cards sit on the ground colour). One soft shadow only on the landing phone mock.
- Buttons: primary 58px tall, secondary 58px with a 2px ink border, danger filled blocked red, quiet as an underlined text link of at least 44px.

## Motion

- The hold ring fills to its used fraction once on load (1.4s ease-out).
- The verification envelope travels between avatars while waiting.
- An outcome icon settles in (0.7s).
- Nothing loops except "waiting" indicators, and nothing moves under `prefers-reduced-motion`.

## Icons

Phosphor, regular weight in content and bold in chips, 20 to 28px, always with `aria-hidden` next to a visible label.

## Voice

Plain words, short sentences, no jargon, no blame. Say what happened and what happens next. After a check: "Checking first was the right thing to do." Never "Nothing has been sent" once money may have moved.

## Concepts

`docs/design/concepts/` holds the approved concept screens (round 1 and round 2). Build each screen to its concept. Differences need a reason in the task report.
