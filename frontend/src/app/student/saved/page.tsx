'use client';

import { useEffect, useState } from 'react';
import { JobCard } from '@/components/jobs/job-card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function SavedJobsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [saved, setSaved] = useState<Array<{ job: Parameters<typeof JobCard>[0]['job'] }>>([]);

  useEffect(() => {
    if (!token) return;
    api<typeof saved>('/saved-jobs', { token }).then(setSaved).catch(console.error);
  }, [token]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Saved Jobs</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {saved.map(({ job }) => <JobCard key={job.id} job={job} />)}
        {saved.length === 0 && <p className="text-muted-foreground">No saved jobs.</p>}
      </div>
    </div>
  );
}
