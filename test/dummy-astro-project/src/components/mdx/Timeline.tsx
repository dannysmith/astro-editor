// React component typed with FC<Props>, using a string enum and children
import type { FC, ReactNode } from 'react'

enum Orientation {
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}

interface TimelineProps {
  title?: string
  orientation?: Orientation
  /** Years to mark on the timeline */
  years: number[]
  children?: ReactNode
}

const Timeline: FC<TimelineProps> = ({ title, orientation = Orientation.Vertical, years, children }) => {
  return (
    <section className={`timeline timeline-${orientation}`}>
      {title && <h3>{title}</h3>}
      <ol>
        {years.map(year => (
          <li key={year}>{year}</li>
        ))}
      </ol>
      {children}
    </section>
  )
}

export default Timeline
