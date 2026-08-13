'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function CreateJobPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'General',
    jobType: 'PART_TIME',
    city: '',
    workMode: 'ON_SITE',
    description: '',
    salaryMin: '',
    salaryMax: '',
    requiredSkills: '',
    freshersOnly: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      await api('/jobs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...form,
          salaryMin: form.salaryMin ? parseInt(form.salaryMin) : undefined,
          salaryMax: form.salaryMax ? parseInt(form.salaryMax) : undefined,
          requiredSkills: form.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      window.location.href = '/employer/jobs';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Create Job Posting</h1>
      <Card className="mt-6">
        <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Job Title</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="mt-1" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">City</label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required className="mt-1" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Job Type</label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm" value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })}>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="TEMPORARY">Temporary</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Work Mode</label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm" value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })}>
                  <option value="ON_SITE">On-site</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Min Salary (₹/mo)</label>
                <Input type="number" value={form.salaryMin} onChange={(e) => setForm({ ...form, salaryMin: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Max Salary (₹/mo)</label>
                <Input type="number" value={form.salaryMax} onChange={(e) => setForm({ ...form, salaryMax: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Required Skills (comma-separated)</label>
              <Input value={form.requiredSkills} onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })} className="mt-1" placeholder="Excel, Communication, Sales" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea className="mt-1 flex min-h-[120px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.freshersOnly} onChange={(e) => setForm({ ...form, freshersOnly: e.target.checked })} />
              Freshers only
            </label>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>{loading ? 'Publishing...' : 'Publish Job'}</Button>
              <Link href="/employer/dashboard"><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
