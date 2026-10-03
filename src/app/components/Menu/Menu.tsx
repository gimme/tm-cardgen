import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
  type RefObject,
} from 'react'

/** something to do, as a button or in a menu */
export interface Action {
  label: string
  danger?: boolean
  act: () => void
}

interface MenuProps {
  items: readonly Action[]
  /** what a click in leaves the menu open: the menu and its button */
  within: RefObject<HTMLElement | null>
  onClose: () => void
  ref?: Ref<HTMLDivElement>
  style?: CSSProperties
}

/** a menu of actions, closed by picking one, a click outside it or Escape */
export function Menu({ items, within, onClose, ref, style }: MenuProps) {
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!within.current?.contains(e.target as Node)) onClose()
    }
    // on the document, so it runs before an Escape heard on the window (the
    // gallery's, say) and stops it: this Escape closes the menu only
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [within, onClose])

  return (
    <div
      className="menu-items"
      role="menu"
      ref={ref}
      style={style}
      // a right-click on the menu leaves it where it is
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.danger ? 'danger' : undefined}
          onClick={() => {
            onClose()
            item.act()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

interface MenuButtonProps {
  items: readonly Action[]
  /** the button's name, for a screen reader */
  label: string
  className: string
  /** -1 leaves the button out of the tab order */
  tabIndex?: number
  /** the view the menu turns up from, where under the button it would run
   *  out of it */
  bounds?: RefObject<HTMLElement | null>
}

/** a ⋮ button, and the menu of `items` it opens under it, or over it where
 *  `bounds` has no room below. Closing, the menu hands the focus it holds
 *  back to the button, rather than losing it */
export function MenuButton({ items, label, className, tabIndex, bounds }: MenuButtonProps) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    if (ref.current?.contains(document.activeElement)) buttonRef.current?.focus()
    setOpen(false)
  }, [])

  // measured under the button before it paints, so it doesn't jump
  useLayoutEffect(() => {
    const view = bounds?.current
    const menu = menuRef.current
    if (!open || !view || !menu) return
    const { top } = view.getBoundingClientRect()
    if (menu.getBoundingClientRect().bottom > top + view.clientHeight) setUp(true)
  }, [open, bounds])

  return (
    <div className={`menu-button ${className}${up ? ' up' : ''}`} ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        tabIndex={tabIndex}
        onClick={() => {
          setOpen((o) => !o)
          // under the button again, to be measured there
          setUp(false)
        }}
      >
        {/* drawn rather than a ⋮, which each font seats off the middle */}
        <svg viewBox="0 0 4 16" width="4" height="16" aria-hidden="true">
          <circle cx="2" cy="3" r="1.5" fill="currentColor" />
          <circle cx="2" cy="8" r="1.5" fill="currentColor" />
          <circle cx="2" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open && <Menu items={items} within={ref} onClose={close} ref={menuRef} />}
    </div>
  )
}
