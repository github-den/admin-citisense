import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import styles from './Tooltip.module.css';

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = TooltipPrimitive.Content;

export default function Tooltip({
  content,
  children,
  align = 'center',
  className = '',
  side = 'top',
  delayDuration = 200,
  contentClassName = '',
}) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <span className={className}>{children}</span>
        </TooltipTrigger>
        {content && (
          <TooltipContent
            side={side}
            align={align}
            sideOffset={8}
            className={[styles.tooltip, contentClassName].filter(Boolean).join(' ')}
          >
            {content}
          </TooltipContent>
        )}
      </TooltipRoot>
    </TooltipProvider>
  );
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent };
