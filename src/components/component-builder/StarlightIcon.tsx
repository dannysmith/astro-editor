import icons from './starlight-icons.json'

const ICONS: Record<string, string> = icons

/**
 * One of Starlight's icons, drawn as Starlight draws it. A name that isn't one
 * of its general icons (the `seti:` file icons) gets an empty space, so names
 * in a list stay lined up. The SVG contents come from Starlight's own icon
 * set, bundled by `scripts/starlight-components/`.
 */
export function StarlightIcon({ name }: { name: string }) {
  const svg = ICONS[name]
  if (!svg) return <span aria-hidden="true" className="size-4 shrink-0" />
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="size-4 shrink-0"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
