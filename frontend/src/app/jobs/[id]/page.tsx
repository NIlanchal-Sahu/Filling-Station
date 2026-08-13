import Link from 'next/link';
import { MapPin, BadgeCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatSalary, formatJobType } from '@/lib/utils';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let job: {
    id: string;
    title: string;
    description: string;
    city: string;
    jobType: string;
    workMode: string;
    salaryMin?: number;
    salaryMax?: number;
    requiredSkills: string[];
    employer: { businessName: string; isVerified: boolean; description?: string };
  } | null = null;

  try {
    job = await api(`/jobs/${id}`);
  } catch {
    job = null;
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p>Job not found</p>
        <Link href="/jobs"><Button className="mt-4">Browse Jobs</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-primary mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>
      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-muted-foreground">
            {job.employer.businessName}
            {job.employer.isVerified && <BadgeCheck className="h-4 w-4 text-primary" />}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.city}</span>
            <span className="rounded bg-muted px-2 py-0.5">{formatJobType(job.jobType)}</span>
            <span className="rounded bg-muted px-2 py-0.5">{formatJobType(job.workMode)}</span>
          </div>
          <p className="mt-4 font-semibold">{formatSalary(job.salaryMin, job.salaryMax)}</p>
          <div className="mt-6">
            <h2 className="font-semibold">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{job.description}</p>
          </div>
          {job.requiredSkills?.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold">Required Skills</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.requiredSkills.map((s) => (
                  <span key={s} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{s}</span>
                ))}
              </div>
            </div>
          )}
          <Link href={`/login?redirect=/jobs/${job.id}`}>
            <Button className="mt-8 w-full md:w-auto">Apply Now</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
