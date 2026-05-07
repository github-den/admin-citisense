import { MagnifyingGlass, FileText, ChatCircle, Heart, WarningCircle } from '@phosphor-icons/react';
import styles from './EmptyState.module.css';

const EMPTY_STATES = {
  search: {
    Icon: MagnifyingGlass,
    title: 'No results found',
    message: 'Try adjusting your search terms or filters',
  },
  feedback: {
    Icon: FileText,
    title: 'No feedback yet',
    message: 'Be the first to share your thoughts',
  },
  discussions: {
    Icon: ChatCircle,
    title: 'No discussions yet',
    message: 'Start a conversation about this feedback',
  },
  saved: {
    Icon: Heart,
    title: 'No saved items',
    message: 'Save feedback to view it here later',
  },
  drafts: {
    Icon: FileText,
    title: 'No drafts',
    message: 'Your unfinished feedback will appear here',
  },
  error: {
    Icon: WarningCircle,
    title: 'Something went wrong',
    message: 'Please try again or contact support',
  },
  default: {
    Icon: FileText,
    title: 'Nothing here',
    message: 'Check back later for updates',
  },
};

export default function EmptyState({ type = 'default', action = null, custom = null }) {
  const config = custom || EMPTY_STATES[type] || EMPTY_STATES.default;
  const { Icon, title, message } = config;

  return (
    <div className={styles.emptyState}>
      <div className={styles.iconWrapper}>
        <Icon size={48} weight="regular" className={styles.icon} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
