import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import styles from './Menu.module.css';

const DropdownMenuRoot = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuContent = DropdownMenuPrimitive.Content;
const DropdownMenuItem = DropdownMenuPrimitive.Item;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;

export default function Menu({ trigger, items, align = 'right', alignOffset = 0, className }) {
  return (
    <DropdownMenuRoot modal={false}>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align={align}
          alignOffset={alignOffset}
          sideOffset={4}
          className={[styles.menu, className].filter(Boolean).join(' ')}
          collisionPadding={8}
        >
          {items.map((item) => {
            if (item.type === 'divider') {
              return <DropdownMenuSeparator key={item.key} className={styles.divider} />;
            }
            const Icon = item.Icon;
            return (
              <DropdownMenuItem
                key={item.key}
                className={[styles.item, item.active ? styles.itemActive : ''].filter(Boolean).join(' ')}
                onSelect={item.onClick}
              >
                {Icon ? <Icon size={17} weight="regular" /> : null}
                <span>{item.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  );
}

export { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator };
