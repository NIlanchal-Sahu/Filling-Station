const faqs = [
  { q: 'Is LocalJob free?', a: 'Yes! Students can browse and apply for free. Employers get 3 free job posts on the Free plan.' },
  { q: 'Who can use LocalJob?', a: 'Students, freshers, part-time workers, and SMB employers looking for local talent.' },
  { q: 'How does AI matching work?', a: 'We compare skills, education, experience, and location to generate a 0-100% match score.' },
  { q: 'Can I hire remotely?', a: 'Yes. Jobs support on-site, remote, and hybrid work modes.' },
  { q: 'How do payments work?', a: 'Premium plans are billed via Razorpay (India) or Stripe (international).' },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Frequently Asked Questions</h1>
      <div className="mt-10 space-y-6">
        {faqs.map(({ q, a }) => (
          <div key={q}>
            <h3 className="font-semibold">{q}</h3>
            <p className="mt-2 text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
