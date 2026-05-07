import { Archive, ChatCircle, CheckCircle, Clock, Rows, Users, WarningCircle } from '@phosphor-icons/react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import StatCard from '../../components/StatCard/StatCard.jsx';
import { useAdminStats } from '@core/hooks/useAdminStats.js';
import { formatCount } from '@core/utils/format.js';
import styles from './DashboardPage.module.css';

const TYPE_COLORS = {
  complaint: '#F97316',
  suggestion: '#D97706',
  compliment: '#16A34A',
};

const STATUS_COLORS = {
  'Under Review': '#94A3B8',
  'In Progress': '#F97316',
  'On hold': '#D97706',
  'Resolved': '#16A34A',
  'Dismissed': '#EF4444',
  'Invalid': '#DC2626',
  'Closed': '#64748B',
};

export default function DashboardPage() {
  const { stats, loading } = useAdminStats();
  const posts = stats?.posts ?? [];

  const typeCounts = ['complaint', 'suggestion', 'compliment'].map(type => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: posts.filter(p => p.type === type).length,
    color: TYPE_COLORS[type],
  }));

  const statusCounts = Object.keys(STATUS_COLORS).map(status => ({
    name: status,
    count: posts.filter(p => p.status === status).length,
    fill: STATUS_COLORS[status],
  }));

  const pendingCount = posts.filter(p => ['Under Review', 'In Progress', 'On hold'].includes(p.status)).length;
  const resolvedCount = posts.filter(p => p.status === 'Resolved').length;
  const invalidCount = posts.filter(p => ['Dismissed', 'Invalid', 'Closed'].includes(p.status)).length;

  const volumeData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    const count = posts.filter(p => new Date(p.created_at).toDateString() === d.toDateString()).length;
    return { date: label, feedbacks: count };
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <span className={styles.sub}>Command center for citizen feedback, service signals, and moderation workload.</span>
        </div>
        <div className={styles.liveBadge}>Live overview</div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard label="Total Feedbacks" value={loading ? '...' : formatCount(stats?.totalPosts)} icon={Rows} color="#2563EB" />
        <StatCard label="Registered Users" value={loading ? '...' : formatCount(stats?.totalUsers)} icon={Users} color="#7C3AED" />
        <StatCard label="Feedboxes" value={loading ? '...' : formatCount(stats?.totalFeedboxes)} icon={Archive} color="#D97706" />
        <StatCard label="Discussions" value={loading ? '...' : formatCount(stats?.totalDiscussions)} icon={ChatCircle} color="#0891B2" />
      </div>

      <div className={styles.opsGrid}>
        <div className={styles.opsCard}>
          <Clock size={18} weight="fill" color="#D97706" />
          <span>Needs action</span>
          <strong>{loading ? '...' : formatCount(pendingCount)}</strong>
        </div>
        <div className={styles.opsCard}>
          <CheckCircle size={18} weight="fill" color="#16A34A" />
          <span>Resolved</span>
          <strong>{loading ? '...' : formatCount(resolvedCount)}</strong>
        </div>
        <div className={styles.opsCard}>
          <WarningCircle size={18} weight="fill" color="#DC2626" />
          <span>Dismissed / invalid / closed</span>
          <strong>{loading ? '...' : formatCount(invalidCount)}</strong>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Feedback Volume - Last 7 Days</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={volumeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid var(--border)', fontSize: 12 }}/>
              <Area type="monotone" dataKey="feedbacks" stroke="#2563EB" strokeWidth={2.5} fill="url(#volGrad)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Feedback by Type</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                {typeCounts.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid var(--border)', fontSize: 12 }}/>
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.chartCardFull}>
        <div className={styles.chartTitle}>Feedback by Status</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={statusCounts} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false}/>
            <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid var(--border)', fontSize: 12 }}/>
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {statusCounts.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
