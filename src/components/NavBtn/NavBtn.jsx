import {
  Archive,
  Bell,
  Buildings,
  BookmarkSimple,
  ChartBar,
  Crosshair,
  Gear,
  GearSix,
  House,
  NotePencil,
  PenNib,
  Question,
  Rocket,
  Rows,
  Scroll,
  SquaresFour,
  UserCircle,
  Users,
} from '@phosphor-icons/react';
import styles from './NavBtn.module.css';

const ICONS = {
  Archive,
  Bell,
  Buildings,
  BookmarkSimple,
  ChartBar,
  Crosshair,
  Gear,
  GearSix,
  House,
  NotePencil,
  PenNib,
  Question,
  Rocket,
  Rows,
  Scroll,
  SquaresFour,
  UserCircle,
  Users,
};

export default function NavBtn({ iconName, label, active, onClick }) {
  const Icon = ICONS[iconName];

  return (
    <button
      className={`${styles.navBtn} ${active ? styles.active : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className={styles.ni}>
        {Icon && (
          <Icon size={22} weight={active ? 'fill' : 'regular'} />
        )}
      </span>
      <span className={styles.label}>{label}</span>
      <span className={styles.activeDot} aria-hidden />
    </button>
  );
}
