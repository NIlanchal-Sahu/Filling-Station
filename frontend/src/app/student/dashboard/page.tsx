'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { JobCard } from '@/components/jobs/job-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function StudentDashboard() {
  const token = useAuthStore((s) => s.accessToken);
  const [recommendations, setRecommendations] = useState<Array<{ job: Parameters<typeof JobCard>[0]['job']; matchScore: number }>>([]);
  const [applications, setApplications] = useState<Array<{ id: string; status: string; job: { title: string; city: string } }>>([]);

  useEffect(() => {
    if (!token) return;
    api<typeof recommendations>('/matching/student/recommendations', { token }).then(setRecommendations).catch(console.error);
    api<typeof applications>('/applications/my', { token }).then(setApplications).catch(console.error);
  }, [token]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Student Dashboard</h1>
      <div className="mt-6 flex gap-3">
        <Link href="/jobs"><Button>Browse Jobs</Button></Link>
        <Link href="/student/profile"><Button variant="outline">Edit Profile</Button></Link>
        <Link href="/student/applications"><Button variant="outline">My Applications</Button></Link>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recommended for You</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recommendations.map(({ job, matchScore }) => (
            <JobCard key={job.id} job={{ ...job, matchScore }} />
          ))}
          {recommendations.length === 0 && <p className="text-muted-foreground">Complete your profile for better recommendations.</p>}
        </div>
      </section>

      <Card className="mt-10">
        <CardHeader><CardTitle>Recent Applications</CardTitle></CardHeader>
        <CardContent>
          {applications.slice(0, 5).map((app) => (
            <div key={app.id} className="flex justify-between py-3 border-b last:border-0">
              <div>
                <p className="font-medium">{app.job.title}</p>
                <p className="text-sm text-muted-foreground">{app.job.city}</p>
              </div>
              <span className="text-xs rounded bg-muted px-2 py-1 h-fit">{app.status}</span>
            </div>
          ))}
          {applications.length === 0 && <p className="text-muted-foreground">No applications yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
