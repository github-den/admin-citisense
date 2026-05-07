import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import styles from './Button.module.css';

const buttonVariants = cva(styles.button, {
  variants: {
    variant: {
      primary: styles.primary,
      secondary: styles.secondary,
      duotone: styles.duotone,
      outline: styles.outline,
      ghost: styles.ghost,
      link: styles.link,
      destructive: styles.destructive,
    },
    size: {
      sm: styles.sm,
      md: styles.md,
      lg: styles.lg,
      icon: styles.icon,
    },
  },
  defaultVariants: {
    variant: 'secondary',
    size: 'md',
  },
});

export default function Button({
  as: Component = 'button',
  asChild = false,
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const Comp = asChild ? Slot : Component;
  
  return (
    <Comp
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {children}
    </Comp>
  );
}
