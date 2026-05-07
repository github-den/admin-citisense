import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowFatUp,
  Bell,
  BookmarkSimple,
  CaretDown,
  ChatCircle,
  Megaphone,
  NotePencil,
  Question,
  SignOut,
  UserCircle,
  GearSix,
} from '@phosphor-icons/react';
import { useAuth } from '@core/context/AuthContext.jsx';
import { notificationItems } from '../../data/notifications.js';
import Avatar from '../ui/Avatar.jsx';
import Button from '../ui/Button.jsx';
import Menu from '../ui/Menu.jsx';
import Popover from '../ui/Popover.jsx';
import SearchInput from '../ui/SearchInput.jsx';
import styles from './TopHeader.module.css';

const FEED_NAV = [
  { key: 'feedForYou', value: 'forYou', label: 'For you' },
  { key: 'feedFollowing', value: 'following', label: 'Following' },
  { key: 'feedBarangay', value: 'barangay', label: 'Your barangay' },
];

const NOTIFICATION_META = {
  Raises: ArrowFatUp,
  Replies: ChatCircle,
  System: Megaphone,
};

function getActiveLabel(items, value, fallback) {
  return items.find((item) => item.value === value)?.label ?? fallback;
}

export default function TopHeader({ page, secondHeader, setPage, setSearchQuery }) {
  const { session, isAuthenticated, openModal, handleSignOut, loading } = useAuth();
  const [notificationTab, setNotificationTab] = useState('all');
  const isOnboardingHeader = page === 'setup' || page === 'create-password';

  // Keep the search input in sync with the URL's ?q= when on the search page
  const searchParams = useSearchParams();
  const urlQuery = page === 'search' ? (searchParams.get('q') ?? '') : '';
  const [searchVal, setSearchVal] = useState(urlQuery);
  useEffect(() => { setSearchVal(urlQuery); }, [urlQuery]);

  const activeFeedLabel = page === 'feed'
    ? getActiveLabel(FEED_NAV, secondHeader?.value, 'For you')
    : 'For you';

  const feedMenuItems = useMemo(() => {
    const visibleNav = isAuthenticated ? FEED_NAV : FEED_NAV.slice(0, 1);
    return visibleNav.map((item) => ({
      ...item,
      active: page === 'feed' && secondHeader?.value === item.value,
      onClick: () => setPage(item.key),
    }));
  }, [page, secondHeader?.value, setPage, isAuthenticated]);

  const headerNotifications = useMemo(() => {
    const visible = notificationItems.filter((item) => notificationTab === 'all' || item.unread);
    return visible.slice(0, 4);
  }, [notificationTab]);

  const unreadCount = useMemo(
    () => notificationItems.filter((item) => item.unread).length,
    [],
  );

  const menuItems = useMemo(() => ([
    { key: 'profile', label: 'My profile', Icon: UserCircle, onClick: () => setPage('profile') },
    { key: 'drafts', label: 'Drafts', Icon: NotePencil, onClick: () => setPage('drafts') },
    { key: 'forlater', label: 'For later', Icon: BookmarkSimple, onClick: () => setPage('forlater') },
    { key: 'settings', label: 'Settings', Icon: GearSix, onClick: () => setPage('settings') },
    { key: 'support', label: 'Support', Icon: Question, onClick: () => setPage('help') },
    { key: 'divider-1', type: 'divider' },
    { key: 'logout', label: 'Logout', Icon: SignOut, onClick: handleSignOut },
  ]), [handleSignOut, setPage]);

  function runSearch(query) {
    const next = String(query ?? '').trim();
    if (!next) return;
    setSearchQuery(next);
    setPage('search');
  }

  return (
    <header className={styles.header}>
      <div className={[styles.inner, isOnboardingHeader ? styles.innerOnboarding : ''].filter(Boolean).join(' ')}>
        <div className={styles.left}>
          <button type="button" className={styles.wordmark} onClick={() => setPage('feed')}>
            citisense
          </button>

          {isAuthenticated && !isOnboardingHeader ? (
          <nav className={styles.nav} aria-label="Primary navigation">
            <Menu
              align="start"
              className={styles.navMenu}
              items={feedMenuItems}
              trigger={(
                <button
                  type="button"
                  className={[styles.navItem, page === 'feed' ? styles.navItemActive : ''].filter(Boolean).join(' ')}
                  aria-current={page === 'feed' ? 'page' : undefined}
                >
                  <span>Feed</span>
                  <CaretDown size={12} weight="bold" />
                </button>
              )}
            />

            <button
              type="button"
              className={[styles.navItem, page === 'feedbox' || page === 'insidebox' ? styles.navItemActive : ''].filter(Boolean).join(' ')}
              onClick={() => setPage('feedbox')}
              aria-current={page === 'feedbox' || page === 'insidebox' ? 'page' : undefined}
            >
              Feedbox
            </button>

            <button
              type="button"
              className={[styles.navItem, page === 'lgu-performance' ? styles.navItemActive : ''].filter(Boolean).join(' ')}
              onClick={() => setPage('cityPerformance')}
              aria-current={page === 'lgu-performance' ? 'page' : undefined}
            >
              LGU Performance
            </button>

            <button
              type="button"
              className={[styles.navItem, page === 'citizen-charter' ? styles.navItemActive : ''].filter(Boolean).join(' ')}
              onClick={() => setPage('cityCharter')}
              aria-current={page === 'citizen-charter' ? 'page' : undefined}
            >
              Citizen Charter
            </button>
          </nav>
          ) : null}
        </div>

        {!isOnboardingHeader ? (
        <div className={styles.right}>
          {loading ? (
            <div className={styles.loadingPlaceholder}>Loading...</div>
          ) : isAuthenticated ? (
            <>
              <SearchInput
                className={styles.search}
                placeholder="Search feedback and citizen"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch(searchVal);
                }}
              />

              <Button variant="primary" size="md" onClick={() => setPage('writefb')}>
                Write
              </Button>

              <Button variant="outline" size="md" onClick={() => setPage('track')}>
                Track
              </Button>

              <Popover
                align="end"
                panelClassName={styles.notificationPanel}
                trigger={(
                  <button
                    type="button"
                    className={styles.notificationButton}
                    aria-label="Notifications"
                  >
                    <Bell size={18} weight="fill" />
                    {unreadCount > 0 ? <span className={styles.notificationDot}>{unreadCount}</span> : null}
                  </button>
                )}
              >
                <div className={styles.notificationHead}>
                  <div className={styles.notificationTabs} role="tablist" aria-label="Notification filters">
                    {['all', 'unread'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        role="tab"
                        aria-selected={notificationTab === item}
                        className={[styles.notificationTab, notificationTab === item ? styles.notificationTabActive : ''].filter(Boolean).join(' ')}
                        onClick={() => setNotificationTab(item)}
                      >
                        {item === 'all' ? 'All' : 'Unread'}
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.seeAllButton} onClick={() => setPage('notifications')}>
                    See all
                  </button>
                </div>

                <div className={styles.notificationList}>
                  {headerNotifications.length > 0 ? headerNotifications.map((item) => {
                    const Icon = NOTIFICATION_META[item.type] ?? Megaphone;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={styles.notificationItem}
                        onClick={() => setPage(item.page)}
                      >
                        <span className={styles.notificationItemIcon}>
                          <Icon size={16} weight="fill" />
                        </span>
                        <span className={styles.notificationItemBody}>
                          <span><strong>{item.actor}</strong> {item.message}</span>
                          <small>{item.time}</small>
                        </span>
                        {item.unread ? <span className={styles.notificationUnreadDot} /> : null}
                      </button>
                    );
                  }) : (
                    <div className={styles.notificationEmpty}>No unread notifications.</div>
                  )}
                </div>
              </Popover>

              <Menu
                align="end"
                items={menuItems}
                trigger={(
                  <button type="button" className={styles.avatarTrigger} aria-label="Profile menu">
                    <Avatar
                      size="md"
                      name={session?.user?.user_metadata?.username || session?.user?.email}
                      src={
                        typeof session?.user?.user_metadata?.avatar === 'string'
                        && session.user.user_metadata.avatar.startsWith('/avatars/')
                          ? session.user.user_metadata.avatar
                          : null
                      }
                    />
                    <span className={styles.avatarChevron}>
                      <CaretDown size={10} weight="bold" />
                    </span>
                  </button>
                )}
              />
            </>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={() => openModal('login')}>
                Log in
              </Button>
              <Button variant="duotone" size="md" onClick={() => openModal('create')}>
                Sign up
              </Button>
            </>
          )}
        </div>
        ) : null}
      </div>
    </header>
  );
}
