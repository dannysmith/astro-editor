/**
 * Spike: generate a JSON manifest of Starlight's built-in MDX components
 * (`@astrojs/starlight/components`) using the real TypeScript type checker.
 *
 * Run: bun scripts/spikes/starlight-manifest/generate.ts
 * Output: docs/tasks-todo/temporary/starlight-manifest.json
 *
 * Uses TypeScript 6 from website/node_modules (the root TS 7 has no JS API) and
 * the Starlight install in website/node_modules.
 */
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import ts from '../../../website/node_modules/typescript/lib/typescript.js'

const repoRoot = path.resolve(import.meta.dir, '../../..')
const websiteModules = path.join(repoRoot, 'website/node_modules')
const starlightDir = realpathSync(
  path.join(websiteModules, '@astrojs/starlight')
)
const barrelPath = path.join(starlightDir, 'dist/components.ts')
const outPath = path.join(
  repoRoot,
  'docs/tasks-todo/temporary/starlight-manifest.json'
)

const IMPORT_SOURCE = '@astrojs/starlight/components'
/** Show literal unions longer than this by their alias name (e.g. `StarlightIcon`). */
const MAX_DISPLAYED_LITERALS = 12
/** Props a writer never needs in the builder. */
const OMITTED_PROPS = new Set(['class'])

/** Hand-authored corrections for things the generator can't infer. */
const OVERRIDES: Record<
  string,
  { has_slot?: boolean; inherited?: Record<string, { required: boolean }> }
> = {
  // Code reads Astro.slots only to throw if anything is slotted.
  Code: { has_slot: false },
  // LinkCard takes href from HTMLAttributes<'a'> (typed optional) but renders a link with it.
  LinkCard: { inherited: { href: { required: true } } },
}

type Kind =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'literals'; values: string[] }
  | { kind: 'array'; items: Kind }
  | { kind: 'date' }
  | { kind: 'image' }
  | { kind: 'collectionEntry'; collection: string }
  | { kind: 'unknown' }

interface PropInfo {
  name: string
  prop_type: string
  kind: Kind
  is_optional: boolean
  default_value: string | null
  description: string | null
}

interface ComponentInfo {
  name: string
  import_source: string
  framework: 'astro'
  has_slot: boolean
  description: string | null
  slot_template: string | null
  props: PropInfo[]
}

// --- 1. Read the barrel to find each exported component and its source file ---

interface ExportEntry {
  name: string
  /** `.astro` file path, or the resolved `.ts` module for re-exports like `Code`. */
  file: string
  /** Name exported by `file` (`default` for .astro). */
  exportedAs: string
}

const barrelText = readFileSync(barrelPath, 'utf8')
const barrelSf = ts.createSourceFile(
  barrelPath,
  barrelText,
  ts.ScriptTarget.Latest,
  true
)

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  allowImportingTsExtensions: true,
  types: [],
}

function resolveModule(specifier: string, fromFile: string): string {
  const resolved = ts.resolveModuleName(
    specifier,
    fromFile,
    compilerOptions,
    ts.sys
  ).resolvedModule
  if (!resolved) throw new Error(`Cannot resolve ${specifier} from ${fromFile}`)
  return resolved.resolvedFileName
}

const exportsList: ExportEntry[] = []
for (const stmt of barrelSf.statements) {
  if (
    !ts.isExportDeclaration(stmt) ||
    !stmt.moduleSpecifier ||
    !stmt.exportClause
  )
    continue
  if (!ts.isNamedExports(stmt.exportClause)) continue
  const spec = (stmt.moduleSpecifier as ts.StringLiteral).text
  for (const el of stmt.exportClause.elements) {
    const exportedAs = (el.propertyName ?? el.name).text
    const file = spec.endsWith('.astro')
      ? path.resolve(path.dirname(barrelPath), spec)
      : resolveModule(spec, barrelPath)
    exportsList.push({ name: el.name.text, file, exportedAs })
  }
}

// --- 2. Build a program with each .astro frontmatter as a virtual .ts file ---

function splitAstro(text: string): { frontmatter: string; template: string } {
  const lines = text.split('\n')
  if (lines[0]?.trim() !== '---') return { frontmatter: '', template: text }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  return {
    frontmatter: lines.slice(1, end).join('\n'),
    template: lines.slice(end + 1).join('\n'),
  }
}

/** Virtual sibling path, so relative imports resolve from the component's own directory. */
const virtualPath = (astroFile: string) => `${astroFile}.ts`

const astroFiles = new Set<string>()
for (const e of exportsList)
  if (e.file.endsWith('.astro')) astroFiles.add(e.file)
// Code is a .ts re-export of Code.astro; include that too so we can read its defaults.
const codeAstro = path.join(
  path.dirname(exportsList.find(e => e.name === 'Code')!.file),
  'Code.astro'
)
astroFiles.add(codeAstro)

const virtualFiles = new Map<
  string,
  { frontmatter: string; template: string }
>()
for (const f of astroFiles) {
  const parts = splitAstro(readFileSync(f, 'utf8'))
  // `Astro` isn't defined outside the Astro compiler; we only need Props to resolve.
  virtualFiles.set(virtualPath(f), {
    ...parts,
    frontmatter: `${parts.frontmatter}\n\ndeclare const Astro: any;\nexport {};\n`,
  })
}

const host = ts.createCompilerHost(compilerOptions, true)
const baseGetSourceFile = host.getSourceFile
host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
  const v = virtualFiles.get(fileName)
  if (v)
    return ts.createSourceFile(fileName, v.frontmatter, languageVersion, true)
  return baseGetSourceFile.call(
    host,
    fileName,
    languageVersion,
    onError,
    shouldCreate
  )
}
const baseFileExists = host.fileExists
host.fileExists = f => virtualFiles.has(f) || baseFileExists.call(host, f)
const baseReadFile = host.readFile
host.readFile = f =>
  virtualFiles.get(f)?.frontmatter ?? baseReadFile.call(host, f)

const roots = [
  ...virtualFiles.keys(),
  ...exportsList.filter(e => !e.file.endsWith('.astro')).map(e => e.file),
]
const program = ts.createProgram(roots, compilerOptions, host)
const checker = program.getTypeChecker()

// --- 3. Type → Kind ---

const isNullish = (t: ts.Type) =>
  (t.flags &
    (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)) !==
  0

function unionMembers(t: ts.Type): ts.Type[] {
  return (t.isUnion() ? t.types : [t]).filter(m => !isNullish(m))
}

const symbolName = (t: ts.Type) => (t.aliasSymbol ?? t.getSymbol())?.getName()

function typeToKind(t: ts.Type): Kind {
  const members = unionMembers(t)
  if (members.length === 0) return { kind: 'unknown' }

  // boolean shows up as `true | false`
  if (members.every(m => m.flags & ts.TypeFlags.BooleanLike))
    return { kind: 'boolean' }
  if (members.every(m => m.isStringLiteral()))
    return {
      kind: 'literals',
      values: members.map(m => (m as ts.StringLiteralType).value),
    }
  if (members.every(m => m.flags & ts.TypeFlags.NumberLike))
    return { kind: 'number' }
  // string | URL, or string widened with some literals
  if (
    members.some(m => m.flags & ts.TypeFlags.String) &&
    members.every(
      m => m.flags & ts.TypeFlags.StringLike || symbolName(m) === 'URL'
    )
  )
    return { kind: 'string' }
  if (members.length === 1) {
    const m = members[0]
    if (symbolName(m) === 'Date') return { kind: 'date' }
    if (checker.isArrayType(m)) {
      const [item] = checker.getTypeArguments(m as ts.TypeReference)
      return {
        kind: 'array',
        items: item ? typeToKind(item) : { kind: 'unknown' },
      }
    }
  }
  return { kind: 'unknown' }
}

function displayType(t: ts.Type, kind: Kind): string {
  if (kind.kind === 'literals' && kind.values.length <= MAX_DISPLAYED_LITERALS)
    return kind.values.map(v => `'${v}'`).join(' | ')
  if (kind.kind === 'boolean') return 'boolean'
  const members = unionMembers(t)
  // Prefer the alias name of the whole type (e.g. StarlightIcon) when there is one.
  if (t.aliasSymbol && !members.some(isNullish)) return t.aliasSymbol.getName()
  return members.map(m => checker.typeToString(m)).join(' | ')
}

// --- 4. Defaults ---

/** `x = 'a'` → "a"; literal numbers/booleans as text; anything else → null. */
function literalText(expr: ts.Expression): string | null {
  if (ts.isStringLiteralLike(expr)) return expr.text
  if (ts.isNumericLiteral(expr)) return expr.text
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return 'true'
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return 'false'
  if (
    ts.isPrefixUnaryExpression(expr) &&
    ts.isNumericLiteral(expr.operand) &&
    expr.operator === ts.SyntaxKind.MinusToken
  )
    return `-${expr.operand.text}`
  return null
}

const isAstroProps = (e: ts.Expression) =>
  ts.isPropertyAccessExpression(e) &&
  ts.isIdentifier(e.expression) &&
  e.expression.text === 'Astro' &&
  e.name.text === 'props'

interface DefaultsResult {
  defaults: Map<string, string>
  /** Identifier passed alongside Astro.props, e.g. `parse(Schema, Astro.props)`. */
  schemaIdentifier: ts.Identifier | null
}

/** Finds `const|let { a = 'x' } = Astro.props` (or `= fn(Schema, Astro.props)`) anywhere in the file. */
function findDefaults(sf: ts.SourceFile): DefaultsResult {
  const defaults = new Map<string, string>()
  let schemaIdentifier: ts.Identifier | null = null
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectBindingPattern(node.name)
    ) {
      const init = node.initializer
      const fromProps = isAstroProps(init)
      const viaCall =
        ts.isCallExpression(init) && init.arguments.some(isAstroProps)
      if (fromProps || viaCall) {
        if (viaCall) {
          const first = (init as ts.CallExpression).arguments[0]
          if (first && ts.isIdentifier(first)) schemaIdentifier = first
        }
        for (const el of node.name.elements) {
          if (el.dotDotDotToken || !el.initializer) continue
          const key = el.propertyName ?? el.name
          if (!ts.isIdentifier(key) && !ts.isStringLiteral(key)) continue
          const value = literalText(el.initializer)
          if (value !== null) defaults.set(key.text, value)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { defaults, schemaIdentifier }
}

/**
 * For props parsed through a Zod schema at runtime (Badge), import the schema's
 * compiled JS and read `.default()` values and `.describe()` text from its shape.
 */
async function zodDefaults(id: ts.Identifier) {
  const defaults = new Map<string, string>()
  const descriptions = new Map<string, string>()
  const symbol = checker.getSymbolAtLocation(id)
  const target =
    symbol && symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol
  const declFile = target?.declarations?.[0]?.getSourceFile().fileName
  if (!declFile) return { defaults, descriptions }
  const jsFile = declFile.replace(/\.d\.ts$/, '.js')
  const mod = await import(jsFile)
  const schema = mod[target!.getName()]
  const shape = schema?.shape as Record<string, any> | undefined
  if (!shape) return { defaults, descriptions }
  for (const [key, field] of Object.entries(shape)) {
    const def = field?._zod?.def
    if (def?.type === 'default') {
      const v =
        typeof def.defaultValue === 'function'
          ? def.defaultValue()
          : def.defaultValue
      if (['string', 'number', 'boolean'].includes(typeof v))
        defaults.set(key, String(v))
    }
    if (typeof field?.description === 'string')
      descriptions.set(key, field.description)
  }
  return { defaults, descriptions }
}

// --- 5. Props extraction ---

/** Props declared in Astro's own types (HTMLAttributes etc.) are inherited noise. */
function isOwnProp(prop: ts.Symbol): boolean {
  const decls = prop.declarations ?? []
  if (decls.length === 0) return true // synthetic (mapped type) props
  return decls.some(
    d => !d.getSourceFile().fileName.includes('/node_modules/astro/')
  )
}

function docText(symbol: ts.Symbol | undefined): string | null {
  if (!symbol) return null
  const text = ts
    .displayPartsToString(symbol.getDocumentationComment(checker))
    .trim()
  return text || null
}

function propsFromType(
  componentName: string,
  propsType: ts.Type,
  defaults: Map<string, string>,
  zodDescriptions: Map<string, string>
): { props: PropInfo[]; dropped: string[] } {
  const props: PropInfo[] = []
  const dropped: string[] = []
  for (const prop of checker.getPropertiesOfType(propsType)) {
    const name = prop.getName()
    const inherited = OVERRIDES[componentName]?.inherited?.[name]
    if (!inherited && !isOwnProp(prop)) {
      dropped.push(name)
      continue
    }
    if (OMITTED_PROPS.has(name)) continue
    const t = checker.getNonNullableType(checker.getTypeOfSymbol(prop))
    const kind = typeToKind(t)
    props.push({
      name,
      prop_type: displayType(t, kind),
      kind,
      is_optional: inherited
        ? !inherited.required
        : (prop.flags & ts.SymbolFlags.Optional) !== 0,
      default_value: defaults.get(name) ?? null,
      description: docText(prop) ?? zodDescriptions.get(name) ?? null,
    })
  }
  return { props, dropped }
}

function findPropsType(sf: ts.SourceFile): ts.Type | null {
  for (const stmt of sf.statements) {
    if (
      (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) &&
      stmt.name.text === 'Props'
    )
      return checker.getTypeAtLocation(stmt.name)
  }
  return null
}

const hasSlot = (frontmatter: string, template: string) =>
  /<slot\b/.test(template) || /Astro\.slots/.test(frontmatter)

const components: ComponentInfo[] = []
const notes: Record<string, { droppedInherited: number }> = {}

for (const entry of exportsList) {
  let propsType: ts.Type | null
  let defaultsSf: ts.SourceFile
  let parts: { frontmatter: string; template: string }
  let description: string | null = null

  if (entry.file.endsWith('.astro')) {
    defaultsSf = program.getSourceFile(virtualPath(entry.file))!
    parts = virtualFiles.get(virtualPath(entry.file))!
    propsType = findPropsType(defaultsSf)
  } else {
    // A typed re-export like `export const Code = C as Component<CodeProps>`: props are param 0.
    const sf = program.getSourceFile(entry.file)!
    const moduleSymbol = checker.getSymbolAtLocation(sf)!
    const exp = checker
      .getExportsOfModule(moduleSymbol)
      .find(s => s.getName() === entry.exportedAs)!
    description = docText(exp)
    const sig = checker.getTypeOfSymbol(exp).getCallSignatures()[0]
    propsType = sig?.parameters[0]
      ? checker.getTypeOfSymbol(sig.parameters[0])
      : null
    defaultsSf = program.getSourceFile(virtualPath(codeAstro))!
    parts = virtualFiles.get(virtualPath(codeAstro))!
  }

  const { defaults, schemaIdentifier } = findDefaults(defaultsSf)
  let zodDescriptions = new Map<string, string>()
  if (schemaIdentifier) {
    const z = await zodDefaults(schemaIdentifier)
    for (const [k, v] of z.defaults) if (!defaults.has(k)) defaults.set(k, v)
    zodDescriptions = z.descriptions
  }

  const { props, dropped } = propsType
    ? propsFromType(entry.name, propsType, defaults, zodDescriptions)
    : { props: [], dropped: [] }
  notes[entry.name] = { droppedInherited: dropped.length }

  components.push({
    name: entry.name,
    import_source: IMPORT_SOURCE,
    framework: 'astro',
    has_slot:
      OVERRIDES[entry.name]?.has_slot ??
      hasSlot(parts.frontmatter, parts.template),
    description,
    slot_template: null,
    props,
  })
}

const starlightVersion = JSON.parse(
  readFileSync(path.join(starlightDir, 'package.json'), 'utf8')
).version
const manifest = { starlight_version: starlightVersion, components }
mkdirSync(path.dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n')

console.log(
  `Starlight ${starlightVersion}: wrote ${components.length} components to ${path.relative(repoRoot, outPath)}`
)
for (const c of components) {
  const summary = c.props
    .map(p => {
      const k =
        p.kind.kind === 'literals'
          ? `literals(${p.kind.values.length})`
          : p.kind.kind === 'array'
            ? `array<${p.kind.items.kind}>`
            : p.kind.kind
      return `${p.name}${p.is_optional ? '?' : ''}:${k}${p.default_value !== null ? `=${JSON.stringify(p.default_value)}` : ''}`
    })
    .join(', ')
  console.log(
    `  ${c.name.padEnd(10)} slot=${c.has_slot ? 'y' : 'n'} dropped=${notes[c.name].droppedInherited} | ${summary}`
  )
}
