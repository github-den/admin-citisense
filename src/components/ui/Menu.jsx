import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import styles from './Menu.module.css';

const DropdownMenuRoot = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuContent = DropdownMenuPrimitive.Content;
const DropdownMenuItem = DropdownMenuPrimitive.Item;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuSubTrigger = DropdownMenuPrimitive.SubTrigger;
const DropdownMenuSubContent = DropdownMenuPrimitive.SubContent;

function renderMenuItem(item) {
  if (item.type === 'divider') {
    return <DropdownMenuSeparator key={item.key} className={styles.divider} />;
  }

  if (item.type === 'label') {
    return <div key={item.key} className={styles.label}>{item.label}</div>;
  }

  if (Array.isArray(item.items) && item.items.length > 0) {
    return (
      <DropdownMenuSub key={item.key}>
        <DropdownMenuSubTrigger
          className={[styles.item, styles.subTrigger, item.active ? styles.itemActive : ''].filter(Boolean).join(' ')}
        >
          <span>{item.label}</span>
          <span className={styles.subIndicator} aria-hidden="true">›</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent
            sideOffset={6}
            alignOffset={-6}
            collisionPadding={8}
            className={[styles.menu, styles.submenu].join(' ')}
          >
            {item.items.map((subItem) => renderMenuItem(subItem))}
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    );
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
}

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
          {items.map((item) => renderMenuItem(item))}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  );
}

export {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
