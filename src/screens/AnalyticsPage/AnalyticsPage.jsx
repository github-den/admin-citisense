import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAdminStats } from '@core/hooks/useAdminStats.js';
import styles from './AnalyticsPage.module.css';

const TYPE_COLORS = ['#F97316', '#D97706', '#16A34A'];
const STATUS_COLORS = ['#94A3B8', '#F97316', '#D97706', '#16A34A', '#EF4444', '#DC2626', '#64748B'];
const STATUSES = ['Under Review', 'In Progress', 'On hold', 'Resolved', 'Dismissed', 'Invalid', 'Closed'];
const TYPES = ['complaint', 'suggestion', 'compliment'];

export default function AnalyticsPage() {
  const { stats, loading } = useAdminStats();
  const posts = stats?.posts ?? [];

  const typeData = TYPES.map((t, i) => ({
    name: t.charAt(0).toUpperCase() + t.slice(1),
    count: posts.filter(p => p.type === t).length,
    fill: TYPE_COLORS[i],
  }));

  const statusData = STATUSES.map((s, i) => ({
    name: s,
    count: posts.filter(p => p.status === s).length,
    fill: STATUS_COLORS[i],
  }));

  const monthlyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      feedbacks: posts.filter(p => new Date(p.created_at).toDateString() === d.toDateString()).length,
    };
  });

  if (loading) return <div className={styles.loading}>Loading analytics...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <span className={styles.sub}>Performance, distribution, and workload trends across the feedback platform.</span>
        </div>
        <div className={styles.liveBadge}>30-day lens</div>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartTitle}>Feedback Submissions - Last 30 Days</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={monthlyData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} interval={4}/>
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false}/>
            <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid var(--border)', fontSize: 12 }}/>
            <Line type="monotone" dataKey="feedbacks" stroke="#2563EB" strokeWidth={2.5} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Feedback Type Distribution</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={typeData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={94} paddingAngle={4}>
                {typeData.map((e, i) => <Cell key={i} fill={e.fill}/>)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid var(--border)', fontSize: 12 }}/>
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Status Breakdown</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 16, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid var(--border)', fontSize: 12 }}/>
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {statusData.map((e, i) => <Cell key={i} fill={e.fill}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
