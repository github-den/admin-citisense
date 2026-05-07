import { MagnifyingGlass } from '@phosphor-icons/react';
import Input from './Input.jsx';
import styles from './SearchInput.module.css';

export default function SearchInput({ className = '', inputClassName = '', ...props }) {
  return (
    <label className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <MagnifyingGlass size={16} weight="bold" className={styles.icon} />
      <Input className={[styles.input, inputClassName].filter(Boolean).join(' ')} {...props} />
    </label>
  );
}
