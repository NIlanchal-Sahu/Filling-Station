'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

const STATUS_STEPS = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED'];

export default function ApplicationsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [applications, setApplications] = useState<Array<{
    id: string;
    status: string;
    matchScore?: number;
    job: { id: string; title: string; city: string; employer?: { businessName: string } };
  }>>([]);

  useEffect(() => {
    if (!token) return;
    api<typeof applications>('/applications/my', { token }).then(setApplications).catch(console.error);
  }, [token]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">My Applications</h1>
      <div className="mt-8 space-y-4">
        {applications.map((app) => {
          const stepIndex = STATUS_STEPS.indexOf(app.status);
          return (
            <Card key={app.id}>
              <CardContent className="p-6">
                <div className="flex justify-between">
                  <div>
                    <Link href={`/jobs/${app.job.id}`} className="font-semibold hover:text-primary">{app.job.title}</Link>
                    <p className="text-sm text-muted-foreground">{app.job.employer?.businessName} · {app.job.city}</p>
                  </div>
                  {app.matchScore && <span className="text-xs text-accent">{app.matchScore}% match</span>}
                </div>
                <div className="mt-4 flex gap-1">
                  {STATUS_STEPS.map((step, i) => (
                    <div key={step} className={`h-1 flex-1 rounded ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`} />
                  ))}
                </div>
                <p className="mt-2 text-sm font-medium">{app.status.replace(/_/g, ' ')}</p>
              </CardContent>
            </Card>
          );
        })}
        {applications.length === 0 && <p className="text-muted-foreground">No applications yet. <Link href="/jobs" className="text-primary">Browse jobs</Link></p>}
      </div>
    </div>
  );
}
