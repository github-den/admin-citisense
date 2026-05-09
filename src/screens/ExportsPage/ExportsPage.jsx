'use client';

import { 
  DownloadSimple, 
  FileCsv, 
  FilePdf, 
  CloudArrowDown,
  Info
} from '@phosphor-icons/react';
import Button from '../../components/ui/Button.jsx';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import styles from '../../styles/adminWorkspace.module.css';

export default function ExportsPage() {
  const workspace = useAdminWorkspace();

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <div className={styles.pageHeader}>
        <div className={styles.inlineHeaderMeta}>
          <h1 className={styles.pageTitle}>Exports</h1>
          <span className={styles.headerDivider}>|</span>
          <span className={styles.headerContext}>Data Hub</span>
        </div>
      </div>

      <div className={styles.panel} style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className={styles.emptyState}>
          <div style={{ marginBottom: '24px', color: 'var(--brand)' }}>
            <CloudArrowDown size={64} weight="duotone" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ui-text)' }}>Centralized Data Hub</h3>
          <p style={{ maxWidth: '440px', margin: '12px auto 24px', color: 'var(--ui-text-muted)', lineHeight: '1.6' }}>
            Generate and download comprehensive data summaries for <strong>{workspace.scopeLabel}</strong>. 
            Detailed bulk exports and historical reporting archives will be available here.
          </p>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Button variant="secondary" size="md" disabled>
              <FileCsv size={18} weight="duotone" />
              Bulk CSV Export
            </Button>
            <Button variant="secondary" size="md" disabled>
              <FilePdf size={18} weight="duotone" />
              Summary PDF
            </Button>
          </div>

          <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ui-text-subtle)', fontSize: '12px', justifyContent: 'center' }}>
             <Info size={14} weight="duotone" />
             <span>Real-time dashboard and list exports are already available on their respective pages.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

