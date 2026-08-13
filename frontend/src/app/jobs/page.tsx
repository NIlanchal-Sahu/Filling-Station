import { JobCard } from '@/components/jobs/job-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface JobsPageProps {
  searchParams: Promise<{ search?: string; city?: string; jobType?: string; remote?: string }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.city) query.set('city', params.city);
  if (params.jobType) query.set('jobType', params.jobType);
  if (params.remote) query.set('remote', 'true');

  let jobs: Parameters<typeof JobCard>[0]['job'][] = [];
  try {
    const res = await api<{ data: typeof jobs }>(`/jobs?${query.toString()}`);
    jobs = res.data;
  } catch {
    jobs = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Browse Jobs</h1>
      <form className="mt-6 flex flex-col gap-3 md:flex-row">
        <Input name="search" placeholder="Search jobs..." defaultValue={params.search} className="md:flex-1" />
        <Input name="city" placeholder="City" defaultValue={params.city} className="md:w-40" />
        <Button type="submit">Filter</Button>
      </form>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
        {jobs.length === 0 && (
          <p className="col-span-full text-muted-foreground">No jobs found. Try different filters.</p>
        )}
      </div>
    </div>
  );
}
