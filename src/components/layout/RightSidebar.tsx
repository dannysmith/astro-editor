import React from 'react'

interface RightSidebarProps {
  children: React.ReactNode
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ children }) => {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border bg-background">
      {children}
    </div>
  )
}
