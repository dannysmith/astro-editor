/** Chart, a fixture component with a default export */
export default function Chart({ values }: { values: number[] }) {
  return <svg aria-label={values.join(', ')} />
}
