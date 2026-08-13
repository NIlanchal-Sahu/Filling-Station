import Link from 'next/link';
import { Search, Users, Building2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JobCard } from '@/components/jobs/job-card';
import { api } from '@/lib/api';

async function getFeaturedJobs() {
  try {
    const res = await api<{ data: Parameters<typeof JobCard>[0]['job'][] }>('/jobs?limit=6');
    return res.data;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const jobs = await getFeaturedJobs();

  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Find Local Jobs <span className="text-primary">Near You</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Part-time, internships, and fresher jobs for students. Hire local talent for your SMB.
          </p>
          <form action="/jobs" className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="search" placeholder="Search jobs, skills, companies..." className="pl-10 h-12" />
            </div>
            <Button type="submit" size="lg">Search Jobs</Button>
          </form>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Part-time', 'Internship', 'Remote', 'Freshers'].map((tag) => (
              <Link key={tag} href={`/jobs?search=${tag}`}>
                <Button variant="outline" size="sm">{tag}</Button>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-2xl font-bold">Featured Jobs</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.length > 0 ? (
              jobs.map((job) => <JobCard key={job.id} job={job} />)
            ) : (
              <p className="text-muted-foreground col-span-full">Start the API to see live jobs, or browse after setup.</p>
            )}
          </div>
          <div className="mt-8 text-center">
            <Link href="/jobs"><Button variant="outline">View All Jobs</Button></Link>
          </div>
        </div>
      </section>

      <section className="bg-card py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-2xl font-bold">How It Works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { icon: Users, title: 'Create Profile', desc: 'Sign up as student or employer in minutes.' },
              { icon: Search, title: 'Search & Match', desc: 'AI-powered matching finds the best fit.' },
              { icon: Building2, title: 'Connect & Hire', desc: 'Chat, interview, and hire locally.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <MapPin className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-2xl font-bold">Hiring for Your Business?</h2>
          <p className="mt-2 text-muted-foreground">Post jobs free. Reach thousands of students in your city.</p>
          <Link href="/signup?role=employer" className="mt-6 inline-block">
            <Button size="lg">Post a Job Free</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
