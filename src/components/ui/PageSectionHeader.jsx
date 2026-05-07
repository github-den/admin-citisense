import styles from './PageSectionHeader.module.css';

export default function PageSectionHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className = '',
  align = 'left',
}) {
  return (
    <header className={[styles.header, align === 'center' ? styles.headerCenter : '', className].filter(Boolean).join(' ')}>
      <div className={styles.copy}>
        <div className={styles.titleRow}>
          {Icon ? (
            <span className={styles.iconWrap}>
              <Icon size={20} weight="fill" />
            </span>
          ) : null}
          <h1>{title}</h1>
        </div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
