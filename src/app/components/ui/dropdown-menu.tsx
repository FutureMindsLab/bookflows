import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface DropdownMenuProps {
  children: React.ReactNode
}

interface DropdownMenuTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

interface DropdownMenuContentProps {
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
}

interface DropdownMenuItemProps {
  children: React.ReactNode
  onSelect?: () => void
  className?: string
}

interface DropdownMenuLabelProps {
  children: React.ReactNode
  className?: string
}

interface DropdownMenuSeparatorProps {
  className?: string
}

const DropdownMenuContext = React.createContext<{
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  triggerRef: React.RefObject<HTMLButtonElement>
}>({
  isOpen: false,
  setIsOpen: () => {},
  triggerRef: { current: null },
})

const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({ children, asChild }) => {
  const { isOpen, setIsOpen, triggerRef } = React.useContext(DropdownMenuContext)
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsOpen(!isOpen)
  }

  if (asChild) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: handleClick,
      ref: triggerRef,
    })
  }

  return <button onClick={handleClick} ref={triggerRef}>{children}</button>
}

const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({ children, align = 'end', className = '' }) => {
  const { isOpen, setIsOpen, triggerRef } = React.useContext(DropdownMenuContext)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [setIsOpen, triggerRef])

  if (!isOpen) return null

  const alignmentClass = align === 'end' ? 'right-0' : 'left-0'

  return createPortal(
    <div
      ref={contentRef}
      className={`absolute z-50 mt-2 ${alignmentClass} w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 ${className}`}
      style={{
        top: triggerRef.current ? triggerRef.current.offsetTop + triggerRef.current.offsetHeight : 0,
        left: triggerRef.current ? triggerRef.current.offsetLeft : 0,
      }}
    >
      <div className="py-1">{children}</div>
    </div>,
    document.body
  )
}

const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({ children, onSelect, className = '' }) => {
  const { setIsOpen } = React.useContext(DropdownMenuContext)
  const handleClick = () => {
    if (onSelect) {
      onSelect()
    }
    setIsOpen(false)
  }

  return (
    <button
      className={`block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

const DropdownMenuLabel: React.FC<DropdownMenuLabelProps> = ({ children, className = '' }) => (
  <span className={`block px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 ${className}`}>
    {children}
  </span>
)

const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps> = ({ className = '' }) => (
  <hr className={`my-1 border-gray-200 dark:border-gray-600 ${className}`} />
)

interface DropdownMenuComponent extends React.FC<DropdownMenuProps> {
  Trigger: typeof DropdownMenuTrigger
  Content: typeof DropdownMenuContent
  Item: typeof DropdownMenuItem
  Label: typeof DropdownMenuLabel
  Separator: typeof DropdownMenuSeparator
}

const DropdownMenu: DropdownMenuComponent = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      {children}
    </DropdownMenuContext.Provider>
  )
}

DropdownMenu.Trigger = DropdownMenuTrigger
DropdownMenu.Content = DropdownMenuContent
DropdownMenu.Item = DropdownMenuItem
DropdownMenu.Label = DropdownMenuLabel
DropdownMenu.Separator = DropdownMenuSeparator

export default DropdownMenu