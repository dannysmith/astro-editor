/** Sparkline, a fixture component exported through a barrel */
export default function Sparkline({ values }: { values: number[] }) {
  return <svg aria-label={values.join(', ')} />
}
