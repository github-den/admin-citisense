import styles from './Avatar.module.css';

function getInitials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CS';
}

export default function Avatar({
  name,
  initials,
  src,
  bg,
  size = 'md',
  className = '',
}) {
  const display = initials || getInitials(name);
  const image = typeof src === 'string' && src.length > 0;
  const altText = name || display;

  return (
    <span
      className={[
        styles.avatar,
        styles[size] ?? styles.md,
        image ? styles.image : '',
        className,
      ].filter(Boolean).join(' ')}
      style={image ? { backgroundImage: `url(${src})` } : (bg ? { background: bg } : undefined)}
      aria-label={altText}
      role="img"
    >
      {image ? null : display}
    </span>
  );
}
