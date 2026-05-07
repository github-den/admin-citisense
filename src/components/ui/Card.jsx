import styles from './Card.module.css';

export default function Card({ className = '', children, ...props }) {
  return (
    <article className={[styles.card, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </article>
  );
}
