'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { JobCard } from '@/components/jobs/job-card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatJobType } from '@/lib/utils';

export default function EmployerJobsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string; city: string; jobType: string; workMode: string; isActive: boolean; _count?: { applications: number } }>>([]);

  useEffect(() => {
    if (!token) return;
    api<typeof jobs>('/jobs/my/list', { token }).then(setJobs).catch(console.error);
  }, [token]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Jobs</h1>
        <Link href="/employer/jobs/new"><Button>Post New Job</Button></Link>
      </div>
      <div className="mt-8 space-y-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold">{job.title}</h3>
                <p className="text-sm text-muted-foreground">{job.city} · {formatJobType(job.jobType)} · {job._count?.applications ?? 0} applicants</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/employer/jobs/${job.id}/applicants`}>
                  <Button variant="outline" size="sm">Applicants</Button>
                </Link>
                <span className={`rounded px-2 py-1 text-xs ${job.isActive ? 'bg-accent/10 text-accent' : 'bg-muted'}`}>
                  {job.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {jobs.length === 0 && <p className="text-muted-foreground">No jobs posted yet.</p>}
      </div>
    </div>
  );
}
