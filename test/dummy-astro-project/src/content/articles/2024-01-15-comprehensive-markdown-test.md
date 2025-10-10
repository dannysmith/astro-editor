---
title: "Comprehensive Markdown Feature Test"
slug: "comprehensive-markdown-test"
description: "A comprehensive test document showcasing all GitHub Flavored Markdown features for editor testing"
pubDate: 2024-01-15
updatedDate: 2024-01-20
tags: ["testing", "markdown", "gfm", "formatting", "documentation"]
author: jane-doe
relatedArticles: [first-article]
---

# Comprehensive Markdown Feature Test

This document showcases all GitHub Flavored Markdown features for comprehensive editor testing.

## Text Formatting

**Bold text** and *italic text* and ***bold italic text***.

~~Strikethrough text~~ and `inline code` and ==highlighted text==.

Subscript: H~2~O and superscript: E=mc^2^

## Links and References

- [External link](https://github.com)
- [Link with title](https://github.com "GitHub Homepage")
- Auto-detected link: https://astro.build
- Email link: test@example.com
- [Reference link][1]
- [Relative link](../notes/note-styleguide.mdx)

[1]: https://github.com/withastro/astro "Astro Framework"

## Lists

### Unordered Lists

- First item
- Second item
  - Nested item
  - Another nested item
    - Deeply nested item
- Third item

### Ordered Lists

1. First ordered item
2. Second ordered item
   1. Nested ordered item
   2. Another nested item
      1. Deeply nested ordered item
3. Third ordered item

### Task Lists

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task
  - [ ] Nested incomplete task
  - [x] Nested completed task

## Code Blocks

### Inline Code

Here's some `inline code` in a sentence.

### Fenced Code Blocks

```javascript
// JavaScript example with syntax highlighting
function greet(name) {
  console.log(`Hello, ${name}!`);
  return `Welcome to the editor, ${name}`;
}

const users = ['Alice', 'Bob', 'Charlie'];
users.forEach(user => greet(user));
```

```python
# Python example
def fibonacci(n):
    """Generate Fibonacci sequence up to n terms."""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
    
    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[i-1] + sequence[i-2])
    return sequence

print(fibonacci(10))
```

```css
/* CSS example with various features */
.markdown-content {
  font-family: 'Inter', system-ui, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 65ch;
  margin: 0 auto;
  padding: 2rem;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3 {
  color: #2563eb;
  margin-top: 2rem;
  margin-bottom: 1rem;
}

@media (prefers-color-scheme: dark) {
  .markdown-content {
    color: #e5e7eb;
    background-color: #1f2937;
  }
}
```

## Tables

| Feature | Supported | Notes |
|---------|-----------|-------|
| Basic Tables | ✅ | Full support |
| Column Alignment | ✅ | Left, center, right |
| Complex Content | ✅ | **Bold**, *italic*, `code` |
| Long Content | ✅ | Cells can contain longer text that wraps naturally |

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left content | Center content | Right content |
| More left | More center | More right |
| Even more left text here | Centered text | Right-aligned text |

## Blockquotes

> This is a simple blockquote.

> This is a longer blockquote that spans multiple lines and demonstrates how blockquotes work with longer content that needs to wrap across multiple lines.

> ### Blockquote with Formatting
> 
> You can use **bold**, *italic*, and other formatting inside blockquotes.
> 
> - Lists work too
> - Another item
> 
> ```javascript
> // Even code blocks
> console.log('Code in blockquotes!');
> ```

> > Nested blockquotes are also supported
> > 
> > > And can be nested multiple levels deep

## Horizontal Rules

---

***

___

## HTML Elements

<details>
<summary>Click to expand details</summary>

This content is hidden by default and can be expanded by clicking the summary.

You can include **markdown** inside details elements too:

- List item 1
- List item 2

```javascript
console.log('Code works in details too!');
```

</details>

<kbd>Ctrl</kbd> + <kbd>C</kbd> to copy

<mark>Highlighted text using HTML mark element</mark>

## Footnotes

Here's a sentence with a footnote[^1].

Here's another sentence with a longer footnote[^longnote].

Multiple footnotes in one paragraph[^2] work fine[^3].

[^1]: This is a simple footnote.

[^longnote]: This is a longer footnote with multiple paragraphs.

    You can include code blocks in footnotes too:
    
    ```javascript
    console.log('Footnote code!');
    ```
    
    And other formatting elements.

[^2]: Second footnote.

[^3]: Third footnote with [a link](https://astro.build).

## Mathematical Expressions

Inline math: $E = mc^2$

Block math:

$$
\frac{1}{n} \sum_{i=1}^{n} x_i = \bar{x}
$$

$$
\begin{align}
f(x) &= x^2 + 2x + 1 \\
     &= (x + 1)^2
\end{align}
$$

## Special Characters and Escaping

\*This text is not italic\*

\# This is not a heading

Here are some special characters: & < > " ' / \

Unicode characters: 🚀 ✨ 💡 🎯 📝 🔧 ⚡ 🌟

Emoji with skin tones: 👋🏽 👨🏻‍💻 👩🏾‍🔬

## Line Breaks and Spacing

This is a paragraph with a soft line break  
created by ending the line with two spaces.

This is a new paragraph after a blank line.

Multiple blank lines



are collapsed into one.

## Complex Combinations

### Table with Complex Content

| Component | Description | Example |
|-----------|-------------|---------|
| **Headers** | Use `#` syntax | `## Heading Level 2` |
| **Lists** | Support nesting | `- Item`<br>`  - Nested` |
| **Code** | Inline and blocks | \`inline\` or \`\`\`blocks\`\`\` |
| **Links** | Various formats | `[text](url)` or `[ref][1]` |

### List with Complex Items

1. **First complex item**
   
   This item has a paragraph description with **bold** and *italic* text.
   
   ```javascript
   // And a code block
   function example() {
     return "complex list item";
   }
   ```
   
   - Nested unordered list
   - With multiple items
   
2. **Second complex item**
   
   > This item contains a blockquote
   > 
   > With multiple lines
   
   | Key | Value |
   |-----|-------|
   | Type | Complex |
   | Status | ✅ Working |

## Edge Cases

### Empty Elements

Empty link: []()

Empty code block:

```

```

### Weird Spacing

Text     with     multiple     spaces.

Text	with	tabs.

### Special Link Cases

[Link with empty title]( "")

[Link with spaces](  https://example.com  )

Auto-link with trailing punctuation: https://example.com.

### Malformed Elements

This is not a proper footnote[^

Unclosed **bold text

Unclosed *italic text

## Conclusion

This document covers all major GitHub Flavored Markdown features and edge cases for comprehensive testing of the markdown editor. It includes various formatting options, complex structures, and edge cases that editors need to handle properly.
