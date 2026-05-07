import styles from './StatCard.module.css';

export default function StatCard({ label, value, icon: Icon, color = 'var(--brand)', trend }) {
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <span className={styles.iconWrap} style={{ background: `${color}18` }}>
            <Icon size={18} weight="fill" color={color} />
          </span>
        )}
      </div>
      <div className={styles.value}>{value ?? '—'}</div>
      {trend != null && (
        <div className={styles.trend} style={{ color: trend >= 0 ? '#16a34a' : '#ef4444' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% from last month
        </div>
      )}
    </div>
  );
}
