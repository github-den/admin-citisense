import { FloppyDisk, ShieldCheck } from '@phosphor-icons/react';
import styles from './AdminSettingsPage.module.css';

const SECTIONS = [
  {
    title: 'Platform identity',
    description: 'Public-facing labels used across the citizen experience.',
    fields: [
      { label: 'Platform name', value: 'CitiSense', type: 'text' },
      { label: 'City / LGU', value: 'Urdaneta City', type: 'text' },
      { label: 'Support email', value: '', type: 'email' },
    ],
  },
  {
    title: 'Feedback rules',
    description: 'Operational defaults for submissions and moderation.',
    fields: [
      { label: 'Allow anonymous feedback', value: false, type: 'toggle' },
      { label: 'Require photo attachment', value: false, type: 'toggle' },
      { label: 'Auto-dismiss after (days)', value: '30', type: 'number' },
    ],
  },
  {
    title: 'Admin security',
    description: 'Recommended safeguards before production deployment.',
    fields: [
      { label: 'Role-based admin access', value: true, type: 'toggle' },
      { label: 'Review flagged feedback', value: true, type: 'toggle' },
    ],
  },
];

export default function AdminSettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <span className={styles.sub}>Platform-wide configuration and launch safeguards.</span>
        </div>
        <div className={styles.headerBadge}>
          <ShieldCheck size={15} weight="bold" />
          Deployment-ready
        </div>
      </div>

      {SECTIONS.map(({ title, description, fields }) => (
        <section key={title} className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>{title}</div>
            <p>{description}</p>
          </div>
          {fields.map(({ label, value, type }) => (
            <div key={label} className={styles.row}>
              <span className={styles.rowLabel}>{label}</span>
              {type === 'toggle'
                ? <label className={styles.switch}><input type="checkbox" defaultChecked={value}/><span /></label>
                : <input type={type} defaultValue={value} className={styles.field}/>
              }
            </div>
          ))}
        </section>
      ))}

      <button className={styles.saveBtn}>
        <FloppyDisk size={16} weight="bold" />
        Save changes
      </button>
    </div>
  );
}
