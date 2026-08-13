import Link from 'next/link';
import { MapPin, Building2, BadgeCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatSalary, formatJobType } from '@/lib/utils';

interface JobCardProps {
  job: {
    id: string;
    title: string;
    city: string;
    jobType: string;
    workMode: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
    isHourly?: boolean;
    isFeatured?: boolean;
    employer?: { businessName: string; logoUrl?: string | null; isVerified?: boolean };
    matchScore?: number;
  };
}

export function JobCard({ job }: JobCardProps) {
  return (
    <Link href={`/jobs/${job.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold hover:text-primary">{job.title}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  {job.employer?.businessName}
                  {job.employer?.isVerified && <BadgeCheck className="h-4 w-4 text-primary" />}
                </p>
              </div>
            </div>
            {job.matchScore !== undefined && (
              <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                {job.matchScore}% match
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.city}</span>
            <span className="rounded bg-muted px-2 py-0.5">{formatJobType(job.jobType)}</span>
            <span className="rounded bg-muted px-2 py-0.5">{formatJobType(job.workMode)}</span>
            {job.isFeatured && <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">Featured</span>}
          </div>
          <p className="mt-3 text-sm font-medium">{formatSalary(job.salaryMin, job.salaryMax, job.isHourly)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
