import * as TabsPrimitive from '@radix-ui/react-tabs';
import styles from './Tabs.module.css';

const TabsRoot = TabsPrimitive.Root;
const TabsList = TabsPrimitive.List;
const TabsTrigger = TabsPrimitive.Trigger;
const TabsContent = TabsPrimitive.Content;

export default function Tabs({ items, value, onChange, className = '' }) {
  return (
    <TabsRoot value={value} onValueChange={onChange} className={className}>
      <TabsList className={styles.tabs}>
        {items.map((item, index) => {
          const key = typeof item === 'string'
            ? item
            : item.key ?? item.value ?? item.id ?? `${item.label}-${index}`;
          const label = typeof item === 'string' ? item : item.label;
          return (
            <TabsTrigger key={key} value={key} className={styles.tab}>
              <span className={styles.label}>{label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </TabsRoot>
  );
}

export { TabsRoot, TabsList, TabsTrigger, TabsContent };
