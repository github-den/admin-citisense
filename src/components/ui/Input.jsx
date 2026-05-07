import { forwardRef } from 'react';
import styles from './Input.module.css';

const Input = forwardRef(({ className = '', type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      className={[styles.input, className].filter(Boolean).join(' ')}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default Input;
