import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">About LocalJob</h1>
      <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
        LocalJob connects students, freshers, and part-time workers with small and medium businesses
        that need local talent — without expensive recruitment platforms or complex hiring processes.
      </p>
      <p className="mt-4 text-muted-foreground leading-relaxed">
        Whether you need a weekend cafe server, a marketing intern, or a delivery partner, LocalJob
        makes it simple to post jobs, discover candidates nearby, and hire quickly.
      </p>
      <Link href="/signup" className="mt-8 inline-block"><Button size="lg">Get Started Free</Button></Link>
    </div>
  );
}
