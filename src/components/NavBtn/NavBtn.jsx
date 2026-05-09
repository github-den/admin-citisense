import Link from 'next/link';
import {
  Archive,
  Bell,
  Buildings,
  BookmarkSimple,
  ChartBar,
  Crosshair,
  DownloadSimple,
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
  WarningCircle,
} from '@phosphor-icons/react';
import { triggerAdminNavigationLoader } from '../NavigationLoader/NavigationLoader.jsx';
import styles from './NavBtn.module.css';

const ICONS = {
  Archive,
  Bell,
  Buildings,
  BookmarkSimple,
  ChartBar,
  Crosshair,
  DownloadSimple,
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
  WarningCircle,
};

export default function NavBtn({ iconName, label, active, onClick, href, badgeCount = 0 }) {
  const Icon = ICONS[iconName];

  const content = (
    <>
      <span className={styles.ni}>
        {Icon && <Icon size={22} weight={active ? 'fill' : 'regular'} />}
      </span>
      <span className={styles.label}>{label}</span>
      {badgeCount > 0 ? <span className={styles.badge}>{badgeCount > 99 ? '99+' : badgeCount}</span> : null}
      <span className={styles.activeDot} aria-hidden />
    </>
  );

  const className = `${styles.navBtn} ${active ? styles.active : ''}`;

  function handleNavigate(event) {
    if (active) return;
    onClick?.(event);
    triggerAdminNavigationLoader();
  }

  if (href) {
    return (
      <Link href={href} className={className} aria-current={active ? 'page' : undefined} onClick={handleNavigate}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleNavigate}
      aria-current={active ? 'page' : undefined}
    >
      {content}
    </button>
  );
}
