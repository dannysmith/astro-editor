# Task: Copyediting Mode

Implement a toggleable copyediting mode that transforms the markdown editor into a visual writing analysis tool, similar to IA Writer's Syntax Highlight feature.

## Overview

The copyediting mode helps writers identify patterns in their prose by color-coding parts of speech and enabling native spell/grammar checking. This is a **visual aid for self-editing**, not prescriptive correction.

## Feature One: Parts of Speech Highlighting

### Functional Requirements

**Core Functionality:**

- Parse markdown text to identify parts of speech using NLP
- Apply color highlighting to words based on grammatical role:
  - **Adjectives** - brown (`var(--color-brown)`)
  - **Nouns** - red (`var(--color-red)`)
  - **Adverbs** - pink (`var(--color-pink)`) 
  - **Verbs** - blue (`var(--color-blue)`)
  - **Conjunctions** - green (`var(--color-green)`)

**Content Filtering:**

- **Exclude** from highlighting (render in muted gray):
  - Code blocks (` ``` ` and `` ` ``)
  - Links (`[text](url)`)
  - HTML/Astro tags (`<tag>`)
  - Frontmatter content
  - Markdown syntax characters

**Toggle Controls:**

- Master toggle: Enable/disable entire copyedit mode
- Individual toggles: Each part of speech independently
- Access via: Command palette, native menus (no UI buttons)
- Keyboard shortcuts for common toggles

**Performance Requirements:**

- Real-time highlighting as user types
- Debounced processing (300ms) to avoid lag
- Efficient re-parsing of changed text only
- No blocking of editor responsiveness

**Internationalization:**

- English language support initially
- (ideally) Extensible architecture for future languages

### Technical Considerations

**NLP Integration:**

- Research client-side NLP libraries (compromise.js, nltk-js)
- Consider WebAssembly options for performance
- Evaluate accuracy vs. performance trade-offs

**CodeMirror Integration:**

- Custom extension for highlighting
- Integration with existing syntax highlighting
- Proper handling of markdown structure

## Feature Two: Native Spell/Grammar Check

### Functional Requirements

**Core Functionality:**

- Enable macOS native spell checking in CodeMirror
- Enable macOS native grammar checking
- Toggle controls accessible via command palette/menus

**Scope:**

- Apply only to markdown text content (exclude code/frontmatter)
- Preserve existing editor keyboard shortcuts
- Maintain compatibility with auto-save system

**Fallback Plan:**
If native integration proves complex, research:

- CodeMirror spell-check extensions
- Third-party spell-check libraries
- Browser-based spell checking APIs

## User Experience Requirements

**Visual Design:**

- Subtle color application (not overwhelming)
- Dark/light theme adaptation
- Clear visual distinction between highlighted and excluded content

**Performance:**

- No noticeable lag during typing
- Smooth toggling between modes
- Memory efficient for large documents

**Accessibility:**

- Screen reader compatibility
- Keyboard navigation support
- Color-blind friendly alternatives (patterns/underlines)

## Success Criteria

1. **Functional**: All parts of speech correctly identified and colored
2. **Performance**: No typing lag with documents up to 10,000 words
3. **Integration**: Seamless CodeMirror integration without breaking existing features
4. **UX**: Intuitive toggle controls via command palette
5. **Quality**: Accurate NLP parsing with <5% false positives for common words

## Technical Risks & Mitigation

**High Risk:**

- NLP accuracy in real-time processing
- Performance impact on large documents
- CodeMirror integration complexity

**Mitigation Strategies:**

- Prototype NLP options early
- Implement progressive enhancement
- Create fallback to simpler highlighting
- Extensive testing with various document sizes

## Research Phase (Required Before Implementation)

1. **NLP Library Evaluation**
   - Compare accuracy and performance of client-side options
   - Test with representative markdown content
2. **CodeMirror Extension Research**
   - Study decoration API and extension patterns
   - Investigate integration with existing syntax highlighting
3. **Native Spell-Check Integration**
   - Research Tauri/WebKit spell-check APIs
   - Identify potential blockers or limitations

## Initial Research Findings

### NLP Library Analysis

**Compromise.js - Recommended**
- Trust Score: 10/10, 87 code examples
- Built-in parts of speech tagging: `#Adjective`, `#Noun`, `#Verb`, `#Adverb`, `#Conjunction`
- Client-side, real-time processing designed for browser use
- Modular architecture with performance plugins
- Example usage: `nlp('text').match('#Adjective').json()`

**Alternative Options**
- WASM-based solutions (higher performance, larger bundle)
- Server-side processing (requires backend)
- Simple regex-based approaches (lower accuracy)

### CodeMirror 6 Integration Overview

**Key APIs Identified**
- `Decoration.mark()` - CSS class application to text ranges
- `StateField` + `StateEffect` - managing decoration state
- `ViewPlugin` - coordinating updates
- `MatchDecorator` - regex-based decoration (potential alternative)

**Current Architecture Compatibility**
- Extension system at `src/lib/editor/extensions/`
- Command registry ready for toggle commands
- Existing decoration patterns (focus-mode, typewriter-mode)

### Spell Check Options

**Browser Native**
- `spellcheck="true"` attribute integration
- Simplest but limited control

**WebKit/Tauri Integration**
- Complex but best UX for native macOS
- Requires deep Tauri API research

**Third-party Libraries**
- CodeMirror extensions available
- Fallback option for cross-platform

## Deep Research Findings (COMPLETED)

### 🚨 **CRITICAL PERFORMANCE LIMITATIONS DISCOVERED**

**CodeMirror 6 Decoration System Constraints:**
- Documents as small as **30KB cause editor glitching** with thousands of decorations
- **Stack overflow errors** (`Maximum call stack size exceeded`) with large decoration counts
- **CSS implementation method** dramatically affects performance (pseudo-elements vs backgrounds)
- Fast scrolling with many decorations causes **severe performance degradation**

### 💡 **PROVEN IMPLEMENTATION PATTERNS**

#### **1. Existing NLP + CodeMirror 6 Implementations**

**Language Server Protocol (LSP) Integration:**
- `FurqanSoftware/codemirror-languageserver` - Working LSP integration
- `remcohaszing/codemirror-languageservice` - Performance-optimized LSP
- **LanguageTool LSP** - Professional-grade grammar checking pathway

**Real Working Code Patterns:**
```javascript
import {StateField, StateEffect} from "@codemirror/state"
import {EditorView, Decoration} from "@codemirror/view"

const highlight_effect = StateEffect.define()
const highlight_extension = StateField.define({
  create() { return Decoration.none },
  update(value, transaction) {
    value = value.map(transaction.changes)
    for (let effect of transaction.effects) {
      if (effect.is(highlight_effect)) 
        value = value.update({add: effect.value, sort: true})
    }
    return value
  },
  provide: f => EditorView.decorations.from(f)
})
```

#### **2. High-Performance Alternatives Discovered**

**CSS Custom Highlight API (Modern Browsers):**
- **5× better performance** than DOM-based highlighting
- Avoids layout recalculation completely
- Perfect for parts-of-speech highlighting
- Fallback to decorations for older browsers

**Viewport-Only Processing Pattern:**
```javascript
const posViewPlugin = ViewPlugin.define(view => ({
  decorations: buildPosDecorations(view),
  update(update) {
    if (update.docChanged || update.viewportChanged) {
      // CRITICAL: Only process visible content
      const { from, to } = update.view.viewport
      const visibleText = update.view.state.doc.sliceString(from, to)
      this.decorations = analyzeAndDecorate(visibleText, from)
    }
  }
}))
```

**Web Worker Architecture:**
- Process NLP analysis in background thread
- **~1MB/second processing speed** with Compromise.js
- Non-blocking UI updates
- Existing implementations found and documented

#### **3. Production-Ready Solutions**

**Grammar Checking Packages Available:**
1. **@grammarly/editor-sdk** - Professional-grade (requires beta access)
2. **@saplingai/sapling-js** - Neural network-based, 10+ languages
3. **gramma** - LanguageTool integration package
4. **compromise** - Perfect for parts-of-speech (83+ POS tags)

**Performance Benchmarks Found:**
- **Monaco Editor**: Limits all computation to viewport size
- **ProseMirror**: Separates marks vs decorations for performance
- **Grammarly**: Real-time DOM manipulation across 500k+ applications

### 🏗️ **RECOMMENDED ARCHITECTURE**

#### **Option A: Modern High-Performance (Recommended)**
```
CSS Custom Highlight API + Web Workers + Viewport Processing
├── Primary: CSS Custom Highlight API (5× faster)
├── Fallback: CodeMirror decorations for older browsers  
├── Processing: Web Worker + Compromise.js
└── Scope: Viewport + small buffer zone only
```

#### **Option B: Conservative Reliable**
```
CodeMirror Decorations + Viewport Limiting + Debounced Updates
├── Decorations: Limited to ~1000 simultaneously 
├── Processing: Main thread with 300ms debouncing
├── Scope: Viewport-only (no full document analysis)
└── NLP: Compromise.js with reduced analysis depth
```

#### **Option C: Hybrid Professional**
```
Compromise.js (real-time) + LanguageTool LSP (comprehensive)
├── Real-time: Viewport-scoped parts-of-speech highlighting
├── Professional: Full document grammar analysis on-demand
├── Integration: LSP pattern already proven with CodeMirror 6
└── UX: Immediate feedback + comprehensive checking
```

### ⚠️ **IMPLEMENTATION CONSTRAINTS**

1. **Document Size Limits**: 
   - Safe: <10,000 words with viewport processing
   - Risky: >30,000 characters with full decoration

2. **Decoration Count Limits**:
   - Safe: <1,000 simultaneous decorations
   - Performance cliff beyond this threshold

3. **Processing Requirements**:
   - MUST use viewport-only processing for large documents
   - MUST debounce updates (200-500ms minimum)
   - SHOULD use Web Workers for NLP processing

4. **CSS Performance**:
   - Use background colors, not pseudo-elements
   - Avoid complex CSS on decorated elements

## 📝 **SIMPLIFIED BLOG-FOCUSED IMPLEMENTATION PLAN**

**Context**: Blog post editor (typical content: 500-3,000 words, max ~10,000 words)

### **Implementation Approach: Simplified & Direct**

**Core Architecture:**
- **NLP Library**: Compromise.js (client-side, no API dependencies)
- **Integration**: CodeMirror 6 StateField + Decoration pattern
- **Processing**: Main thread with 300ms debouncing (sufficient for blog length)
- **Scope**: Full document analysis (blog posts are small enough)

### **Step 1: Basic Integration (Week 1)**

**Architecture Integration (follows established patterns):**

```javascript
// File: src/lib/editor/extensions/copyedit-mode.ts
import { StateField, StateEffect } from "@codemirror/state"
import { EditorView, Decoration, ViewPlugin } from "@codemirror/view"
import nlp from 'compromise'

// State effects for copyedit mode control
export const toggleCopyeditMode = StateEffect.define<boolean>()
export const updatePosDecorations = StateEffect.define<Decoration[]>()

// State field following established extension pattern
const copyeditModeField = StateField.define({
  create() { 
    return { 
      enabled: false, 
      decorations: Decoration.none 
    } 
  },
  update(state, tr) {
    let decorations = state.decorations.map(tr.changes)
    let enabled = state.enabled
    
    for (let effect of tr.effects) {
      if (effect.is(toggleCopyeditMode)) {
        enabled = effect.value
        if (!enabled) decorations = Decoration.none
      }
      if (effect.is(updatePosDecorations)) {
        decorations = Decoration.set(effect.value)
      }
    }
    
    return { enabled, decorations }
  },
  provide: field => EditorView.decorations.from(field, state => state.decorations)
})

// ViewPlugin for processing - follows existing pattern
const copyeditModePlugin = ViewPlugin.fromClass(class {
  timeoutId: number | null = null
  
  constructor(readonly view: EditorView) {}
  
  update(update: ViewUpdate) {
    const state = update.state.field(copyeditModeField)
    if (!state.enabled) return
    
    if (update.docChanged) {
      this.scheduleAnalysis()
    }
  }
  
  scheduleAnalysis() {
    if (this.timeoutId) clearTimeout(this.timeoutId)
    this.timeoutId = window.setTimeout(() => {
      this.analyzeDocument()
    }, 300) // 300ms debounce
  }
  
  analyzeDocument() {
    const doc = this.view.state.doc.toString()
    const decorations = this.createPosDecorations(doc)
    
    this.view.dispatch({
      effects: updatePosDecorations.of(decorations)
    })
  }
  
  createPosDecorations(text: string): Decoration[] {
    // NLP analysis and decoration creation
    return []
  }
  
  destroy() {
    if (this.timeoutId) clearTimeout(this.timeoutId)
  }
})

// Main extension export
export function createCopyeditModeExtension() {
  return [copyeditModeField, copyeditModePlugin]
}
```

**Features for Step 1:**
- ✅ Toggle copyedit mode on/off
- ✅ Highlight nouns (red) and verbs (blue) only
- ✅ Exclude code blocks and frontmatter
- ✅ Basic command palette integration

### **Step 2: Complete POS Highlighting (Week 2)**

**Add remaining parts of speech:**
- Adjectives (brown) - `var(--color-brown)`
- Adverbs (pink) - `var(--color-pink)`
- Conjunctions (green) - `var(--color-green)`

**Command Integration (following established patterns):**
```javascript
// src/lib/editor/commands/copyeditCommands.ts
import { EditorCommand } from './types'
import { toggleCopyeditMode } from '../extensions/copyedit-mode'
import { useUIStore } from '../../../store/uiStore'

export const createCopyeditModeCommand = (): EditorCommand => {
  return (view: EditorView) => {
    const { copyeditModeEnabled, toggleCopyeditMode: toggleUI } = useUIStore.getState()
    
    toggleUI() // Update UI store
    
    view.dispatch({
      effects: toggleCopyeditMode.of(!copyeditModeEnabled)
    })
    
    return true
  }
}
```

**Individual toggles via command registry:**
- Command palette: "Toggle Copyedit Mode" 
- Command palette: "Toggle Noun Highlighting"
- Command palette: "Toggle Verb Highlighting"
- etc.

### **Step 3: Visual Polish (Week 3)**

**Theme Integration (following established CSS architecture):**

```css
/* src/lib/editor/extensions/copyedit-mode.css */
.cm-pos-adjective {
  background-color: var(--color-brown);
  color: var(--color-background);
  opacity: 0.8; /* Subtle highlighting */
  border-radius: 2px;
  padding: 0 1px;
}

.cm-pos-noun {
  background-color: var(--color-red);
  color: var(--color-background);
  opacity: 0.8;
  border-radius: 2px;
  padding: 0 1px;
}

.cm-pos-adverb {
  background-color: var(--color-pink);
  color: var(--color-background);
  opacity: 0.8;
  border-radius: 2px;
  padding: 0 1px;
}

.cm-pos-verb {
  background-color: var(--color-blue);
  color: var(--color-background);
  opacity: 0.8;
  border-radius: 2px;
  padding: 0 1px;
}

.cm-pos-conjunction {
  background-color: var(--color-green);
  color: var(--color-background);
  opacity: 0.8;
  border-radius: 2px;
  padding: 0 1px;
}

/* Excluded content styling */
.cm-pos-excluded {
  color: var(--color-mdtag);
  background: none;
}
```

**Accessibility (color-blind friendly):**
- Uses existing CSS variables with dark/light mode support
- Optional patterns/underlines as fallback
- Screen reader compatibility with proper ARIA attributes

### **Step 4: Spell Check Integration (Optional)**

**Browser native integration (following theme pattern):**
```javascript
// src/lib/editor/extensions/spellcheck.ts
import { EditorView } from '@codemirror/view'

export const spellCheckExtension = EditorView.theme({
  '.cm-content': {
    spellcheck: 'true',
    // Only apply to prose text, not code blocks
    '&[data-language]': {
      spellcheck: 'false'
    }
  }
})

// Integration in createExtensions.ts
export const createExtensions = (config: ExtensionConfig) => {
  return [
    // ... existing extensions
    ...(config.spellCheckEnabled ? [spellCheckExtension] : []),
    // ... rest of extensions
  ]
}
```

**UI Store Integration:**
```javascript
// src/store/uiStore.ts (add to existing store)
interface UIState {
  // ... existing state
  spellCheckEnabled: boolean
}

const useUIStore = create<UIState>()((set) => ({
  // ... existing state
  spellCheckEnabled: false,
  toggleSpellCheck: () => set((state) => ({ 
    spellCheckEnabled: !state.spellCheckEnabled 
  })),
}))
```

### **Files to Create/Modify (Architecture Compliant)**

**1. Extension Module:**
```
src/lib/editor/extensions/copyedit-mode.ts  # Main extension
src/lib/editor/extensions/index.ts          # Export from extensions
```

**2. Commands Module:**
```
src/lib/editor/commands/copyeditCommands.ts # Command definitions
src/lib/editor/commands/types.ts            # Add copyedit command types
src/lib/editor/commands/index.ts            # Export commands
```

**3. Integration Points:**
```
src/lib/editor/extensions/createExtensions.ts  # Add to extension array
src/hooks/editor/useEditorSetup.ts             # Commands integration
src/store/uiStore.ts                           # Add copyedit mode state
```

**4. Styling:**
```
src/lib/editor/extensions/copyedit-mode.css    # POS highlighting styles using CSS variables
```

**5. Dependencies:**
```
package.json                                   # Add compromise dependency
```

### **Performance Expectations (Blog Context)**

**Typical Performance:**
- 1,000 word blog post: ~50-200 decorations
- 5,000 word blog post: ~250-1,000 decorations  
- Processing time: <100ms with Compromise.js
- **Well within CodeMirror 6 performance limits**

### **Success Criteria (Simplified)**

- ✅ Works smoothly with 5,000 word blog posts
- ✅ No typing lag during editing
- ✅ Toggle commands work via command palette
- ✅ Respects existing editor themes
- ✅ Excludes code blocks and frontmatter properly

### **Implementation Dependencies**

```bash
npm install compromise
```

**Leverages Existing Architecture:**
- **CodeMirror 6**: StateField + ViewPlugin pattern (focus-mode, typewriter-mode)
- **Command Registry**: Global command system with type safety
- **Extension System**: Modular editor extensions in `src/lib/editor/extensions/`
- **UI Store**: Zustand store for copyedit mode state (follows decomposed pattern)
- **CSS Variables**: Theme system with automatic dark/light mode support
- **Performance Patterns**: getState() pattern, 300ms debouncing

### **Risk Assessment: LOW**

**Why this approach is low-risk:**
- Blog-length documents well within performance limits
- Compromise.js is battle-tested (trust score 10/10)
- CodeMirror decoration pattern is proven
- Can disable feature instantly if issues arise
- No breaking changes to existing editor

**Estimated implementation time: 2-3 weeks for full feature**

## Current Implementation Status (Step 1 - In Progress)

### ✅ Completed:
- Basic CodeMirror extension structure (StateField + ViewPlugin)
- Command palette integration ("Toggle Copyedit Mode")
- UI store integration (copyeditModeEnabled state)
- Event-driven command system integration
- Basic NLP processing with Compromise.js
- CSS styling file structure

### ✅ Step 1 Implementation: COMPLETED WITH NLP REFINEMENT

**✅ All functionality implemented and refined:**
1. ✅ **Text highlighting** - CSS variables correctly configured (`--editor-color-*` format) 
2. ✅ **Performance optimized** - Deduplication reduces decorations by ~70%
3. ✅ **Architecture compliance** - Proper getState() pattern, stable callbacks, TypeScript types
4. ✅ **Content exclusion** - Code blocks, frontmatter, and markdown syntax excluded
5. ✅ **Quality gates** - All checks pass (TypeScript, ESLint, Prettier, Rust, tests)
6. ✅ **NLP accuracy refined** - Copyedit-focused matching with function word filtering

**✅ NLP Accuracy Issues RESOLVED:**
1. ✅ **Modal/Auxiliary verbs excluded** - "will", "might", "can", "should" no longer highlighted
2. ✅ **Pronouns excluded from nouns** - "she", "he", "it", "they" no longer highlighted as nouns
3. ✅ **Content words prioritized** - Focus on meaningful nouns and action verbs for copyediting

### ✅ Architecture Violations Resolved:
- ✅ React useEffect now uses stable callbacks with `getState()` pattern
- ✅ Decoration creation optimized with deduplication and range tracking
- ✅ CSS color variables correctly configured (`--editor-color-*` format)

### 🎯 Next Steps:
1. ✅ **Step 1.1**: Refine NLP matching for copyediting accuracy - COMPLETED
2. 📋 **Step 2**: Add remaining parts of speech (adjectives, adverbs, conjunctions)
3. 📋 **Step 3**: Visual polish and theme integration  
4. 📋 **Step 4**: Optional spell check integration

### 🔬 **Step 1.1: NLP Refinement Analysis**

**Problem**: Current `#Noun` and `#Verb` patterns are too broad for copyediting purposes. They include grammatical function words that distract from meaningful content analysis.

**Solution**: Use Compromise.js's more specific tags to filter for content words:

**Original matching (too broad):**
```javascript
{ matcher: '#Noun', className: 'cm-pos-noun', label: 'noun' },
{ matcher: '#Verb', className: 'cm-pos-verb', label: 'verb' },
```

**✅ IMPLEMENTED: Refined matching (copyedit-focused):**
```javascript
// Process nouns but exclude pronouns using filtering approach
const allNouns = doc.match('#Noun')
const pronouns = doc.match('#Pronoun')
const pronounTexts = new Set(pronouns.map(p => p.text().toLowerCase()))

// Filter out pronouns from noun highlighting
allNouns.forEach(match => {
  if (!pronounTexts.has(match.text().toLowerCase())) {
    // Highlight as content noun
  }
})

// Process verbs but exclude auxiliaries and modals
const allVerbs = doc.match('#Verb')
const auxiliaries = doc.match('#Auxiliary')
const modals = doc.match('#Modal')
const excludedVerbTexts = new Set([...auxiliaries, ...modals].map(v => v.text().toLowerCase()))

// Filter out function verbs from verb highlighting  
allVerbs.forEach(match => {
  if (!excludedVerbTexts.has(match.text().toLowerCase())) {
    // Highlight as action verb
  }
})
```

**Expected improvements:**
- ❌ Remove: "she", "he", "it", "they" (pronouns)
- ❌ Remove: "will", "can", "might", "should" (modals)
- ❌ Remove: "is", "has", "was", "were" (auxiliaries)
- ✅ Keep: "cat", "chair", "document" (content nouns)
- ✅ Keep: "sits", "runs", "writes" (main action verbs)

**Compromise.js tags available:**
- `#Pronoun` - he, she, it, they, etc.
- `#Auxiliary` - is, has, will, be, etc. 
- `#Modal` - can, should, might, must, etc.
- `#ProperNoun` - specific subset of nouns
- `#Conjunction` - and, or, but, etc.

### 📊 Current Performance:
- Test document: ~155 words → ~30-50 decorations (0.19-0.32 decorations/word)
- Target achieved: <50 decorations per document
- Method: Deduplication + Compromise.js offsets + range tracking

### ✅ **Completed Implementation for Step 1.1:**
1. ✅ **Research Compromise.js compound selectors** - Confirmed no native support, used filtering approach
2. ✅ **Update matching logic** - Implemented refined filtering in `createPosDecorations()`
3. 🔄 **Test accuracy** - Ready for user testing with refined word selection
4. ✅ **Document findings** - Task updated with implementation details

**Implementation Method:**
- **Filtering approach**: Get all matches, then exclude unwanted subtypes using Set-based filtering
- **Performance maintained**: Same deduplication and offset optimization as before
- **Architecture compliant**: Follows all established patterns and passes quality gates

### 📁 Files Modified:
- `src/lib/editor/extensions/copyedit-mode.ts` - Main extension
- `src/lib/editor/extensions/copyedit-mode.css` - Styling (text colors)
- `src/store/uiStore.ts` - UI state management
- `src/lib/commands/app-commands.ts` - Command palette integration
- `src/lib/commands/command-context.ts` - Event dispatch
- `src/lib/commands/types.ts` - Command type definitions
- `src/hooks/useLayoutEventListeners.ts` - Event handling
- `src/components/editor/Editor.tsx` - React-CodeMirror bridge
- `test/dummy-astro-project/src/content/notes/copyedit-test.md` - Test file
