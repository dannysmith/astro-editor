# Notes on Editor Typography and Colours

This file manually Compiled by Danny. This document is ONLY to be used for styling the markdown editor itself.

## Colour Palette

These colour variables should be available in CSS inside the editor and anywhere else we need to use them. Even if these colours are not currently in use, they should remain available because we will use all of them at some point.

They're implemented as the `--editor-color-*` tokens in `src/App.css`, converted to oklch and written with `light-dark()`.

### Common Colours

```css
--color-carat: rgba(0, 195, 255, 1);
```

### Light Mode Colours

```css
--color-background: rgba(247, 247, 247, 1);
--color-text: rgba(25, 25, 25, 1);
--color-mdtag: rgba(179, 181, 176, 1);
--color-underline: rgba(214, 212, 209, 1);
--color-brown: rgba(165, 101, 27, 1);
--color-red: rgba(201, 72, 37, 1);
--color-pink: rgba(177, 79, 159, 1);
--color-blue: rgba(53, 118, 182, 1);
--color-green: rgba(66, 131, 44, 1);
--color-codeblock-background: rgba(238, 238, 238, 1);
--color-selectedtext-background: rgba(185, 234, 250, 1);

--color-highlight-background: rgba(
  252,
  236,
  147,
  1
); /* Unused - for the future */
--color-highlight-underline: rgba(255, 215, 0, 1); /* Unused - for the future */
--color-highlight-text: var(--color-text); /* Unused - for the future  */
```

### Dark Mode Colours

```css
--color-background: rgba(26, 26, 26, 1);
--color-text: rgba(204, 204, 204, 1);
--color-mdtag: rgba(122, 122, 120, 1);
--color-underline: rgba(84, 84, 82, 1);
--color-brown: rgba(192, 148, 86, 1);
--color-red: rgba(216, 133, 107, 1);
--color-pink: rgba(186, 142, 177, 1);
--color-blue: rgba(124, 159, 192, 1);
--color-green: rgba(131, 165, 115, 1);
--color-codeblock-background: rgba(37, 37, 37, 1);
--color-selectedtext-background: rgba(20, 68, 84, 1);

--color-highlight-background: rgba(68, 59, 15, 1); /* Unused - for the future */
--color-highlight-underline: rgba(214, 176, 0, 1); /* Unused - for the future */
--color-highlight-text: rgba(220, 206, 157, 1); /* Unused - for the future */
```

## Break Points

## Typography - Common

### Base

- Font: iA Writer Duo Variable
- Weight: 490
- Letter Spacing: 0.07em

### Markdown Headings

- Weight: 700

### Bold Text and MD Tags

- Weight: 700

### Italic Text and MD Tags

- Font: iA Writer Duo Variable Italic

## Typography - Breakpoints

### Tiny Width (Default)

Applies: Editor Pane width under 440px
Font Size: 16.5px
Line Height: 1.609 (26.65px)

### Small Width

Applies: Editor Pane width over 439px and under 875px
Font Size: 18px
Line Height: 1.742 (31.36px)

### Medium Width

Applies: Editor Pane width over 874px and under 1250px
Font Size: 18px
Line Height: 1.742 (31.36px)

### Large Width

Applies: Editor Pane width over 1249px and under 1660px
Font Size: 21px
Line Height: 1.721 (36.14px)

### Huge Width

Applies: Editor Pane width over 1659px
Font Size: 24px
Line Height: 1.7916 (43px)

## Content Measure

### Tiny Width (Default)

Applies: Editor Pane width under 440px
Left and Right Margin: 24px
Content Width: Fluid

### Small Width

Applies: Editor Pane width over 439px and under 875px
Left and Right Margin: 74px
Content Width: Fluid

### Medium Width

Applies: Editor Pane width over 874px and under 1250px
Left and Right Margin: Auto
Content Width: 705px

### Large Width

Applies: Editor Pane width over 1249px and under 1660px
Left and Right Margin: Auto
Content Width: 800px

### Huge Width

Applies: Editor Pane width over 1659px
Left and Right Margin: Auto
Content Width: 980px

## Colour - Markdown Syntax Highlighting

### Base

Editor Pane Background: --color-background
All Markdown not otherwise coloured: --color-text

### Markdown Images and Links

- `![]()` characters: --color-mdtag
- `<>` characters (links without text): --color-mdtag
- URLs (between `[]`): --color-mdtag with underline in --color-underline
- URL text: md-tag-chars

### Footnotes

- `[^]:` characters: --color-mdtag

### Lists

`-[]` markers in checklists: --color-mdtag
`-` or `*` markers in unordered lists: --color-mdtag
`1.` markers in ordered lists: --color-mdtag

### Code Block and Inline code

- Inline code block background: --color-codeblock-background
- Fenced code block background: --color-codeblock-background
- Backtick Markers: --color-mdtag

### Carat and Selection

- Carat: --color-carat
- Selected Text: --color-selectedtext-background
