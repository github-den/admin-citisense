import { useState, useRef } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import styles from './Popover.module.css';

const PopoverRoot = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = PopoverPrimitive.Content;

export default function Popover({
  trigger,
  children,
  align = 'start',
  className = '',
  panelClassName = '',
  hoverable = false,
  onOpenChange,
  open: controlledOpen,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (val) => {
    if (controlledOpen === undefined) setInternalOpen(val);
    onOpenChange?.(val);
  };

  const closeTimeout = useRef(null);

  const handleMouseEnter = () => {
    if (!hoverable) return;
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (!hoverable) return;
    closeTimeout.current = setTimeout(() => setOpen(false), 300);
  };

  return (
    <PopoverRoot open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span 
          className={className} 
          onMouseEnter={handleMouseEnter} 
          onMouseLeave={handleMouseLeave}
        >
          {trigger}
        </span>
      </PopoverTrigger>
      <PopoverPrimitive.Portal>
        <PopoverContent
          align={align}
          sideOffset={8}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={[styles.panel, panelClassName].filter(Boolean).join(' ')}
          collisionPadding={8}
        >
          {children}
        </PopoverContent>
      </PopoverPrimitive.Portal>
    </PopoverRoot>
  );
}

export { PopoverRoot, PopoverTrigger, PopoverContent };
