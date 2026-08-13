'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function AdminDashboard() {
  const token = useAuthStore((s) => s.accessToken);
  const [analytics, setAnalytics] = useState<{
    totalUsers: number;
    totalEmployers: number;
    totalJobs: number;
    totalApplications: number;
    revenue: { estimatedMRR: number };
  } | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string; isSuspended: boolean }>>([]);

  useEffect(() => {
    if (!token) return;
    api<typeof analytics>('/admin/analytics', { token }).then(setAnalytics).catch(console.error);
    api<typeof users>('/admin/users', { token }).then(setUsers).catch(console.error);
  }, [token]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Users', value: analytics?.totalUsers },
          { label: 'Employers', value: analytics?.totalEmployers },
          { label: 'Jobs', value: analytics?.totalJobs },
          { label: 'Applications', value: analytics?.totalApplications },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-6">
              <p className="text-2xl font-bold">{value ?? '—'}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {analytics?.revenue && (
        <p className="mt-4 text-sm text-muted-foreground">Est. MRR: ₹{analytics.revenue.estimatedMRR.toLocaleString()}</p>
      )}
      <h2 className="mt-10 text-xl font-semibold">Users</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="py-2 text-left">Email</th><th className="py-2 text-left">Role</th><th className="py-2 text-left">Status</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.role}</td>
                <td className="py-2">{u.isSuspended ? 'Suspended' : 'Active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
