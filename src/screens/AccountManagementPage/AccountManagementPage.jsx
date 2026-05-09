import { useEffect, useMemo, useState } from 'react';
import {
  CaretDown,
  CaretLeft,
  CheckCircle,
  ClockClockwise,
  DownloadSimple,
  MapPin,
  ShieldCheck,
  User,
  UserCircleGear,
  UserPlus,
  XCircle,
} from '@phosphor-icons/react';
import DataTable from '../../components/DataTable/DataTable.jsx';
import Button from '../../components/ui/Button.jsx';
import Menu from '../../components/ui/Menu.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import { useAdminUsers } from '@core/hooks/useAdminUsers.js';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import { USER_ROLES } from '@core/lib/auth/roles.js';
import { SERVICE_CATEGORY_OPTIONS, URDANETA_BARANGAYS } from '@/constants/index.js';
import { exportRowsToCsv, exportRowsToXlsx } from '@core/lib/exporters.js';
import { showToast } from '../../components/Toast/Toast.jsx';
import { getInitials } from '@core/utils/format.js';
import styles from '../../styles/adminWorkspace.module.css';

const ADMIN_ROLES = new Set([USER_ROLES.SUPER_ADMIN, USER_ROLES.LGU_ADMIN, USER_ROLES.BARANGAY_ADMIN]);
const PAGE_SIZE = 10;

function buildMockLogs(user) {
  const base = user.role === USER_ROLES.CITIZEN
    ? ['Raised a flag', 'Received warning', 'Suspension reviewed']
    : ['Reviewed feedback', 'Dismissed feedback', 'Posted official response'];

  return base.map((label, index) => ({
    id: `${user.id}-${index}`,
    label,
    target: user.role === USER_ROLES.CITIZEN ? user.username || 'Citizen account' : `Feedback ${index + 1}`,
    timestamp: new Date(Date.now() - ((index + 1) * 86400000)).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  }));
}

function formatRoleLabel(role) {
  if (role === USER_ROLES.SUPER_ADMIN) return 'Super Admin';
  if (role === USER_ROLES.LGU_ADMIN) return 'LGU Admin';
  if (role === USER_ROLES.BARANGAY_ADMIN) return 'Barangay Admin';
  return 'Citizen';
}

function formatAccountTableRoleLabel(role) {
  if (role === USER_ROLES.SUPER_ADMIN) return 'Super Admin';
  if (role === USER_ROLES.LGU_ADMIN) return 'LGU Admin';
  if (role === USER_ROLES.BARANGAY_ADMIN) return 'Brgy Admin';
  return 'Citizen';
}

function getRoleFilterOptions() {
  return [
    { value: 'all', label: 'All roles' },
    { value: USER_ROLES.SUPER_ADMIN, label: 'Super Admin' },
    { value: USER_ROLES.LGU_ADMIN, label: 'LGU Admin' },
    { value: USER_ROLES.BARANGAY_ADMIN, label: 'Barangay Admin' },
    { value: USER_ROLES.CITIZEN, label: 'Citizen' },
  ];
}

function getStatusFilterOptions() {
  return [
    { value: 'all', label: 'All status' },
    { value: 'enabled', label: 'Enabled' },
    { value: 'disabled', label: 'Disabled' },
  ];
}

function getEmailDisplay(user) {
  return String(
    user.email
    ?? user.raw?.email
    ?? user.raw_user_meta_data?.email
    ?? user.metadata?.email
    ?? '',
  ).trim() || 'No email on profile';
}

function createMenuItems(options, currentValue, onChange, valueMap = null) {
  return options.map((option) => {
    const value = valueMap ? valueMap(option) : option.value;
    return {
      key: String(value),
      label: option.label,
      active: currentValue === value,
      onClick: () => onChange(value),
    };
  });
}

function buildExportRows(rows, disabledUsers) {
  return rows.map((user, index) => ({
    no: String(index + 1).padStart(3, '0'),
    username: user.username ?? '',
    email: getEmailDisplay(user),
    role: formatRoleLabel(user.role),
    status: disabledUsers[user.id] ? 'Disabled' : 'Enabled',
    scope: user.location ?? '',
    created_at: user.created_at ?? '',
  }));
}

export default function AccountManagementPage() {
  const workspace = useAdminWorkspace();
  const { users, loading } = useAdminUsers();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [disabledUsers, setDisabledUsers] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const [editingUserId, setEditingUserId] = useState(null);
  const [logDateFilter, setLogDateFilter] = useState('all');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [draftAccount, setDraftAccount] = useState({
    role: USER_ROLES.LGU_ADMIN,
    username: '',
    email: '',
    office: SERVICE_CATEGORY_OPTIONS[0]?.office ?? '',
    barangay: URDANETA_BARANGAYS[2] ?? '',
  });

  const hasActiveFilters = Boolean(
    query.trim()
    || roleFilter !== 'all'
    || statusFilter !== 'all',
  );

  const filteredUsers = useMemo(() => users.filter((user) => {
    const disabled = !!disabledUsers[user.id];
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (statusFilter === 'enabled' && disabled) return false;
    if (statusFilter === 'disabled' && !disabled) return false;

    const haystack = [
      user.username,
      getEmailDisplay(user),
      user.location,
      formatRoleLabel(user.role),
    ].join(' ').toLowerCase();

    return haystack.includes(query.trim().toLowerCase());
  }), [disabledUsers, query, roleFilter, statusFilter, users]);

  const pagedUsers = filteredUsers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalRecords = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const selectedUser = filteredUsers.find((user) => user.id === selectedUserId) ?? users.find((user) => user.id === selectedUserId) ?? null;
  const selectedLogs = selectedUser ? buildMockLogs(selectedUser) : [];
  const visibleUserIds = pagedUsers.map((user) => String(user.id));
  const allVisibleSelected = visibleUserIds.length > 0 && visibleUserIds.every((id) => selectedUserIds.includes(id));
  const selectedUsers = useMemo(
    () => filteredUsers.filter((user) => selectedUserIds.includes(String(user.id))),
    [filteredUsers, selectedUserIds],
  );

  useEffect(() => {
    setPage(0);
  }, [query, roleFilter, statusFilter]);

  useEffect(() => {
    setPageInput(String(Math.min(page + 1, totalPages || 1)));
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedUserIds((current) => current.filter((id) => filteredUsers.some((user) => String(user.id) === id)));
  }, [filteredUsers]);

  function resetDraftAccount() {
    setDraftAccount({
      role: USER_ROLES.LGU_ADMIN,
      username: '',
      email: '',
      office: SERVICE_CATEGORY_OPTIONS[0]?.office ?? '',
      barangay: URDANETA_BARANGAYS[2] ?? '',
    });
    setEditingUserId(null);
  }

  function openCreateForm() {
    resetDraftAccount();
    setShowCreateForm(true);
  }

  function toggleDisabled(user) {
    const nextDisabled = !disabledUsers[user.id];
    setDisabledUsers((current) => ({ ...current, [user.id]: nextDisabled }));
    showToast(`${user.username || 'This account'} is now ${nextDisabled ? 'disabled' : 'enabled'}.`, 'info', 3000);
  }

  function handleCreateAccount(event) {
    event.preventDefault();
    const modeLabel = editingUserId ? 'Account update' : 'Account creation';
    showToast(`${modeLabel} is not connected yet.`, 'info', 3000);
  }

  function handleEditUser(user) {
    setEditingUserId(user.id);
    setDraftAccount({
      role: user.role ?? USER_ROLES.LGU_ADMIN,
      username: user.username ?? '',
      email: getEmailDisplay(user) === 'No email on profile' ? '' : getEmailDisplay(user),
      office: user.location ?? SERVICE_CATEGORY_OPTIONS[0]?.office ?? '',
      barangay: user.location ?? URDANETA_BARANGAYS[2] ?? '',
    });
    setShowCreateForm(true);
  }

  async function handleExport(scope, format) {
    const rows = scope === 'selected'
      ? selectedUsers
      : scope === 'current'
        ? pagedUsers
        : filteredUsers;
    const exportRows = buildExportRows(rows, disabledUsers);
    const filename = `accounts-${scope}.${format}`;
    const success = format === 'csv'
      ? exportRowsToCsv(filename, exportRows)
      : exportRowsToXlsx(filename, exportRows, 'Accounts');

    if (!success) {
      showToast('No account rows are available to export yet.', 'warning');
      return;
    }

    showToast(`Accounts export generated as ${format.toUpperCase()}.`, 'success');
  }

  function toggleRowSelection(userId) {
    const normalizedId = String(userId);
    setSelectedUserIds((current) => (
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    ));
  }

  function toggleSelectAllVisible() {
    setSelectedUserIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleUserIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleUserIds]));
    });
  }

  function commitPageInput(value) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(Math.min(page + 1, totalPages)));
      return;
    }

    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    setPage(clamped - 1);
    setPageInput(String(clamped));
  }

  function clearFilters() {
    setRoleFilter('all');
    setStatusFilter('all');
    setQuery('');
  }

  const exportMenuItems = [
    {
      key: 'export-all',
      label: 'All',
      items: [
        { key: 'export-all-csv', label: 'CSV', onClick: () => handleExport('all', 'csv') },
        { key: 'export-all-xlsx', label: 'XLSX', onClick: () => handleExport('all', 'xlsx') },
      ],
    },
    {
      key: 'export-current',
      label: 'Current page',
      items: [
        { key: 'export-current-csv', label: 'CSV', onClick: () => handleExport('current', 'csv') },
        { key: 'export-current-xlsx', label: 'XLSX', onClick: () => handleExport('current', 'xlsx') },
      ],
    },
    ...(selectedUsers.length ? [{
      key: 'export-selected',
      label: 'Selected',
      items: [
        { key: 'export-selected-csv', label: 'CSV', onClick: () => handleExport('selected', 'csv') },
        { key: 'export-selected-xlsx', label: 'XLSX', onClick: () => handleExport('selected', 'xlsx') },
      ],
    }] : []),
  ];

  if (!workspace.isSuperAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>Account management is reserved for the Super Admin workspace.</div>
      </div>
    );
  }

  if (selectedUser) {
    const isCitizen = !ADMIN_ROLES.has(selectedUser.role);

    return (
      <div className={`${styles.page} ${styles.pageWide}`}>
        <div className={styles.pageHeader}>
          <div className={styles.inlineHeaderMeta}>
            <button type="button" className={styles.detailBack} onClick={() => setSelectedUserId(null)}>
              <CaretLeft size={14} weight="bold" />
              Accounts
            </button>
            <span className={styles.headerDivider}>|</span>
            <h1 className={styles.pageTitle}>{selectedUser.username || 'Unnamed account'}</h1>
          </div>
          <div className={styles.rowActions}>
            <div className={styles.avatar} aria-hidden>{getInitials(selectedUser.username || 'A')}</div>
            <div className={styles.cellStack}>
              <div className={styles.cellTitle} style={{ fontSize: '13px' }}>System Access</div>
              <label className={styles.switch}>
                <input type="checkbox" checked={!disabledUsers[selectedUser.id]} onChange={() => toggleDisabled(selectedUser)} />
                <span />
              </label>
            </div>
          </div>
        </div>

        <div className={styles.detailMeta} style={{ marginBottom: '24px' }}>
          <span className={styles.typePill}>
            <User size={14} weight="duotone" />
            {formatRoleLabel(selectedUser.role)}
          </span>
          <span className={styles.statusPill}>
            <MapPin size={14} weight="duotone" />
            {selectedUser.location || 'No scope'}
          </span>
          <span className={disabledUsers[selectedUser.id] ? styles.alertPill : styles.statusPill}>
            <CheckCircle size={14} weight="duotone" />
            {disabledUsers[selectedUser.id] ? 'Disabled' : 'Enabled'}
          </span>
        </div>

        <div className={styles.splitColumns}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>
                  <ClockClockwise size={18} weight="duotone" />
                  Activity Log
                </div>
                <div className={styles.panelMeta}>Audit history for this account.</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => showToast('Activity log export is not connected yet.', 'info', 2500)}>
                <DownloadSimple size={14} weight="duotone" />
                Export
              </Button>
            </div>
            <div className={styles.filterRow} style={{ marginTop: '12px' }}>
              <select className={styles.chipSelect} value={logDateFilter} onChange={(event) => setLogDateFilter(event.target.value)}>
                <option value="all">Any Date</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
              <select className={styles.chipSelect} value={logActionFilter} onChange={(event) => setLogActionFilter(event.target.value)}>
                <option value="all">Any Action</option>
                <option value="reviewed">Reviewed</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
            <div className={styles.timeline} style={{ marginTop: 20 }}>
              {selectedLogs.map((log) => (
                <div key={log.id} className={styles.timelineItem}>
                  <div className={styles.timelineIcon}><ShieldCheck size={14} weight="duotone" color="var(--brand)" /></div>
                  <div className={styles.cellStack}>
                    <div className={styles.cellTitle}>{log.label}</div>
                    <div className={styles.cellSub}>{log.target} · {log.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>
                  <UserCircleGear size={18} weight="duotone" />
                  Account Controls
                </div>
                <div className={styles.panelMeta}>{isCitizen ? 'Citizen account controls.' : 'Admin account controls.'}</div>
              </div>
            </div>
            <div className={styles.list} style={{ marginTop: '12px' }}>
              {isCitizen ? (
                <>
                  <div className={styles.listItem}>
                    <div className={styles.listRow}>
                      <div className={styles.cellStack}>
                        <div className={styles.cellTitle}>Suspend</div>
                        <div className={styles.cellSub}>Temporary restriction with duration.</div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => showToast(`Suspension queued for ${selectedUser.username || 'this citizen'}.`, 'warning', 2500)}>Suspend</Button>
                    </div>
                  </div>
                  <div className={styles.listItem}>
                    <div className={styles.listRow}>
                      <div className={styles.cellStack}>
                        <div className={styles.cellTitle}>Ban</div>
                        <div className={styles.cellSub}>Irreversible account ban.</div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => showToast(`Ban queued for ${selectedUser.username || 'this citizen'}.`, 'warning', 2500)}>Ban Account</Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.listItem}>
                  <div className={styles.listRow}>
                    <div className={styles.cellStack}>
                      <div className={styles.cellTitle}>System Access</div>
                      <div className={styles.cellSub}>Use when logs show a pattern of abuse.</div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => toggleDisabled(selectedUser)}>
                      {disabledUsers[selectedUser.id] ? 'Enable Account' : 'Disable Account'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          className={styles.tableCheckbox}
          aria-label="Select all visible accounts"
          checked={allVisibleSelected}
          onChange={toggleSelectAllVisible}
        />
      ),
      width: 44,
      render: (user) => (
        <input
          type="checkbox"
          className={styles.tableCheckbox}
          aria-label={`Select ${user.username || 'account'}`}
          checked={selectedUserIds.includes(String(user.id))}
          onChange={() => toggleRowSelection(user.id)}
        />
      ),
    },
    {
      key: 'no',
      label: 'NO.',
      width: 68,
      render: (user) => {
        const rowIndex = filteredUsers.findIndex((item) => item.id === user.id);
        const displayNo = rowIndex >= 0 ? String(rowIndex + 1).padStart(3, '0') : '---';
        return <span className={styles.feedbackNumber}>{displayNo}</span>;
      },
    },
    {
      key: 'username',
      label: 'Username',
      render: (user) => <span className={styles.cellBody}>{user.username || 'Unnamed account'}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (user) => <span className={styles.cellBody}>{getEmailDisplay(user)}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      width: 112,
      render: (user) => (
        <span className={styles.tableCapsuleText}>
          {formatAccountTableRoleLabel(user.role)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 84,
      render: (user) => (
        <span className={`${styles.tableCapsuleText} ${disabledUsers[user.id] ? styles.tableStatusDisabled : styles.tableStatusEnabled}`}>
          {disabledUsers[user.id] ? 'Disabled' : 'Enabled'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 88,
      render: (user) => (
        <div className={styles.actionColumn}>
          <button type="button" className={styles.actionLink} onClick={() => setSelectedUserId(user.id)}>
            View logs
          </button>
          <button type="button" className={styles.actionLink} onClick={() => handleEditUser(user)}>
            Edit
          </button>
          <button type="button" className={styles.actionLink} onClick={() => toggleDisabled(user)}>
            {disabledUsers[user.id] ? 'Enable' : 'Disable'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Accounts</h1>
        </div>
        <div className={styles.pageActions}>
          <Button variant="primary" size="md" onClick={() => (showCreateForm ? setShowCreateForm(false) : openCreateForm())}>
            <UserPlus size={16} weight="bold" />
            Create Account
          </Button>
          <SearchInput
            className={styles.searchControl}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search account"
          />
        </div>
      </div>

      {showCreateForm ? (
        <section className={styles.panel} style={{ marginBottom: '24px' }}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>{editingUserId ? 'Edit Account' : 'Create Account'}</div>
              <div className={styles.panelMeta}>{editingUserId ? 'Update account details for this admin user.' : 'Provision access for LGU or Barangay offices.'}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateForm(false);
                resetDraftAccount();
              }}
            >
              <XCircle size={18} weight="duotone" />
            </Button>
          </div>
          <form onSubmit={handleCreateAccount} style={{ marginTop: '16px' }}>
            <div className={styles.formGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Administrative Role</label>
                <select className={styles.select} value={draftAccount.role} onChange={(event) => setDraftAccount((current) => ({ ...current, role: event.target.value }))}>
                  <option value={USER_ROLES.LGU_ADMIN}>LGU Admin</option>
                  <option value={USER_ROLES.BARANGAY_ADMIN}>Barangay Admin</option>
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Username</label>
                <input className={styles.field} placeholder="e.g. juandelacruz" value={draftAccount.username} onChange={(event) => setDraftAccount((current) => ({ ...current, username: event.target.value }))} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Official Email Address</label>
                <input className={styles.field} placeholder="email@urdaneta.gov.ph" value={draftAccount.email} onChange={(event) => setDraftAccount((current) => ({ ...current, email: event.target.value }))} />
              </div>
              {draftAccount.role === USER_ROLES.LGU_ADMIN ? (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Assigned Office</label>
                  <select className={styles.select} value={draftAccount.office} onChange={(event) => setDraftAccount((current) => ({ ...current, office: event.target.value }))}>
                    {SERVICE_CATEGORY_OPTIONS.map((option) => <option key={option.office} value={option.office}>{option.office}</option>)}
                  </select>
                </div>
              ) : (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Assigned Barangay</label>
                  <select className={styles.select} value={draftAccount.barangay} onChange={(event) => setDraftAccount((current) => ({ ...current, barangay: event.target.value }))}>
                    {URDANETA_BARANGAYS.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className={styles.buttonRow} style={{ marginTop: 24 }}>
              <Button variant="primary" size="md" type="submit">{editingUserId ? 'Save Account' : 'Provision Account'}</Button>
              <Button
                variant="ghost"
                size="md"
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  resetDraftAccount();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.toolbar}>
        <div className={styles.selectionSummary}>
          <Menu
            align="start"
            items={exportMenuItems}
            trigger={(
              <Button variant="secondary" size="md">
                <DownloadSimple size={15} weight="bold" />
                Export
              </Button>
            )}
          />
          <span className={styles.selectionCount}>{selectedUsers.length} selected</span>
        </div>

        <div className={styles.filterRow}>
          <Menu
            align="start"
            items={createMenuItems(getRoleFilterOptions(), roleFilter, setRoleFilter)}
            trigger={(
              <Button
                variant="secondary"
                size="md"
                className={`${styles.filterMenuTrigger} ${roleFilter !== 'all' ? styles.filterMenuTriggerActive : ''}`}
              >
                Role
                <CaretDown size={12} weight="bold" />
              </Button>
            )}
          />

          <Menu
            align="start"
            items={createMenuItems(getStatusFilterOptions(), statusFilter, setStatusFilter)}
            trigger={(
              <Button
                variant="secondary"
                size="md"
                className={`${styles.filterMenuTrigger} ${statusFilter !== 'all' ? styles.filterMenuTriggerActive : ''}`}
              >
                Status
                <CaretDown size={12} weight="bold" />
              </Button>
            )}
          />

          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={clearFilters}
            className={`${styles.filterMenuTrigger} ${hasActiveFilters ? styles.filterMenuTriggerActive : styles.filterMenuTriggerMuted}`}
            aria-disabled={!hasActiveFilters}
          >
            Clear all
          </Button>
        </div>
      </section>

      <section className={styles.tablePanel}>
        <DataTable
          columns={columns}
          rows={pagedUsers}
          loading={loading}
          minWidth={860}
          empty="No accounts match the current filters."
        />
      </section>

      <div className={styles.resultsFooter}>
        <div className={styles.pagination}>
          <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(current - 1, 0))} disabled={page === 0}>
            Prev
          </Button>
          <span className={styles.paginationLabel}>Page</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className={styles.pageInput}
            value={pageInput}
            onChange={(event) => {
              const digitsOnly = event.target.value.replace(/\D+/g, '');
              setPageInput(digitsOnly);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitPageInput(pageInput);
              }
            }}
            aria-label="Page number"
          />
          <span className={styles.paginationLabel}>of {totalPages}</span>
          <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))} disabled={page >= totalPages - 1}>
            Next
          </Button>
        </div>

        <div className={styles.resultsMeta}>
          Showing results {pagedUsers.length} out of {totalRecords}
        </div>
      </div>
    </div>
  );
}
