'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function ApplicantsPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.accessToken);
  const [applicants, setApplicants] = useState<Array<{
    id: string;
    status: string;
    matchScore?: number;
    student: { fullName: string; skills: string[]; resumeUrl?: string };
  }>>([]);

  useEffect(() => {
    if (!token || !id) return;
    api<typeof applicants>(`/jobs/${id}/applications`, { token }).then(setApplicants).catch(console.error);
  }, [token, id]);

  async function updateStatus(applicationId: string, status: string) {
    if (!token) return;
    await api(`/applications/${applicationId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    setApplicants((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status } : a)));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Applicants</h1>
      <div className="mt-8 space-y-4">
        {applicants.map((app) => (
          <Card key={app.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{app.student.fullName}</h3>
                  <p className="text-sm text-muted-foreground">{app.student.skills.join(', ')}</p>
                  {app.matchScore && (
                    <span className="mt-2 inline-block rounded bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      {app.matchScore}% match
                    </span>
                  )}
                </div>
                <span className="text-xs rounded bg-muted px-2 py-1">{app.status}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => updateStatus(app.id, 'SHORTLISTED')}>Shortlist</Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(app.id, 'INTERVIEW_SCHEDULED')}>Interview</Button>
                <Button size="sm" variant="accent" onClick={() => updateStatus(app.id, 'SELECTED')}>Hire</Button>
                <Button size="sm" variant="ghost" onClick={() => updateStatus(app.id, 'REJECTED')}>Reject</Button>
                {app.student.resumeUrl && (
                  <a href={app.student.resumeUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">Resume</Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {applicants.length === 0 && <p className="text-muted-foreground">No applicants yet.</p>}
      </div>
    </div>
  );
}
