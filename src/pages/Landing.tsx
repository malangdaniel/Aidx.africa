import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bot,
  ClipboardList,
  HeartPulse,
  Lock,
  MessageSquareText,
  Pill,
  ShieldCheck,
  Stethoscope,
  Truck,
  Video,
} from "lucide-react";
import SEO, { SITE_URL } from "@/components/seo/SEO";
import Reveal from "@/components/landing/Reveal";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import logo from "@/assets/sanari-logo.png";
import heroImage from "@/assets/landing-hero.jpg";
import doctorImage from "@/assets/landing-doctor.jpg";

const STEPS = [
  {
    icon: Bot,
    label: "Ask",
    title: "Describe your symptoms",
    body: "Chat with our AI health assistant in plain language. It asks the right follow-up questions and flags anything urgent in seconds.",
  },
  {
    icon: Stethoscope,
    label: "Assess",
    title: "See a licensed doctor",
    body: "Book a video or chat consultation with a verified Nigerian doctor, at a time that fits your day. Get a real diagnosis and a plan.",
  },
  {
    icon: Truck,
    label: "Act",
    title: "Get medication delivered",
    body: "Your e-prescription goes straight to a partner pharmacy, and your medication is delivered to your door.",
  },
];

const FEATURES = [
  { icon: Activity, title: "AI symptom triage", body: "Structured assessment with severity detection, so you know whether to rest, book, or seek emergency care." },
  { icon: Video, title: "Video & chat consults", body: "Talk to licensed doctors from home, work or anywhere with a connection — no waiting rooms." },
  { icon: ClipboardList, title: "E-prescriptions", body: "Digital prescriptions issued during your consult and sent to pharmacies instantly." },
  { icon: Pill, title: "Pharmacy delivery", body: "Order genuine medication from partner pharmacies with transparent pricing and tracked delivery." },
  { icon: HeartPulse, title: "Health record tracking", body: "Log blood pressure, weight, temperature and more. Your doctor sees the full picture." },
  { icon: MessageSquareText, title: "Consultation history", body: "Every note, diagnosis and prescription stored securely and available for your next visit." },
];

// PLACEHOLDER STATS — replace with your real, verified numbers before launch.
const STATS = [
  { value: "10,000+", label: "consultations completed" },
  { value: "250+", label: "verified doctors" },
  { value: "120+", label: "partner pharmacies" },
  { value: "36", label: "states served" },
];

// PLACEHOLDER TESTIMONIALS — replace with real, consented patient quotes.
const TESTIMONIALS = [
  { quote: "I checked my symptoms at 11pm and had spoken to a doctor before midnight. My medication arrived the next morning.", name: "A. Okafor", meta: "Lagos · Placeholder testimonial" },
  { quote: "Being able to keep all my blood pressure readings in one place changed how my doctor manages my treatment.", name: "F. Bello", meta: "Abuja · Placeholder testimonial" },
  { quote: "The AI assistant helped me explain what I was feeling clearly. The consultation was far more useful because of it.", name: "C. Eze", meta: "Enugu · Placeholder testimonial" },
];

const FAQS = [
  { q: "Are the doctors on Sanari AI licensed in Nigeria?", a: "Yes. Every doctor completes a verification process where medical licence and credentials are reviewed before they can accept consultations." },
  { q: "Does the AI assistant replace a doctor?", a: "No. The AI assistant helps you understand possible causes of your symptoms and points you to the right next step. It does not replace a licensed medical professional." },
  { q: "How fast is pharmacy delivery?", a: "Delivery times depend on your location and the partner pharmacy fulfilling the order. You can track the status of every order in the app." },
  { q: "Is my health data private?", a: "Your records are encrypted in transit and stored with strict access rules, so only you and the clinicians treating you can view them." },
  { q: "How much does a consultation cost?", a: "Each doctor sets their own consultation fee, shown before you book. Payment is held securely and only released after your consultation." },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Sanari AI core services",
    itemListElement: [
      { "@type": "ListItem", position: 1, item: { "@type": "Service", name: "AI symptom assessment", serviceType: "AI health triage", areaServed: "NG", provider: { "@type": "MedicalOrganization", name: "Sanari AI" } } },
      { "@type": "ListItem", position: 2, item: { "@type": "Service", name: "Online doctor consultation", serviceType: "Telemedicine", areaServed: "NG", provider: { "@type": "MedicalOrganization", name: "Sanari AI" } } },
      { "@type": "ListItem", position: 3, item: { "@type": "Service", name: "Pharmacy medication delivery", serviceType: "Pharmacy delivery", areaServed: "NG", provider: { "@type": "MedicalOrganization", name: "Sanari AI" } } },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Sanari AI | Online Doctor & Pharmacy Delivery Nigeria"
        description="AI symptom assessment, video consultations with licensed Nigerian doctors and pharmacy delivery to your door. Ask. Assess. Act."
        path="/"
        jsonLd={jsonLd}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-nav">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="Sanari AI home">
            <img src={logo} alt="Sanari AI logo" className="h-8 w-auto" width={120} height={32} />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#services" className="text-sm font-medium text-muted-foreground hover:text-foreground">Services</a>
            <a href="#trust" className="text-sm font-medium text-muted-foreground hover:text-foreground">Why Sanari</a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-ambient-mesh">
          <div className="container grid items-center gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
                Ask · Assess · Act
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Healthcare that starts with a{" "}
                <span className="text-accent">conversation</span>.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Sanari AI brings symptom assessment, licensed doctor consultations and
                pharmacy delivery into one place — built for Nigeria, available wherever
                you are.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-accent text-accent-foreground shadow-glow-coral hover:bg-accent/90">
                  <Link to="/auth">
                    Get started <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how-it-works">How it works</a>
                </Button>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Free to join · Verified doctors · Secure payments held until your consult
              </p>
            </Reveal>

            <Reveal delay={120} className="relative">
              <div className="relative mx-auto max-w-md overflow-hidden rounded-[2rem] shadow-luxury lg:max-w-none">
                <img
                  src={heroImage}
                  alt="A woman using the Sanari AI app on her phone to check her symptoms"
                  width={1280}
                  height={1600}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="glass-panel absolute -bottom-5 left-1/2 flex w-[86%] -translate-x-1/2 items-center gap-3 rounded-2xl p-4 lg:left-6 lg:w-auto lg:translate-x-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium leading-tight">
                  “Persistent headache and fever for 2 days”
                  <span className="block text-xs text-muted-foreground">Assessed in under a minute</span>
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-border/60 py-20 md:py-28">
          <div className="container px-4 md:px-8">
            <Reveal className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Three steps from symptom to treatment
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                No queues, no guesswork. Sanari AI carries you through the full journey.
              </p>
            </Reveal>

            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal as="li" key={step.label} delay={i * 100}>
                  <div className="glass-card-hover h-full rounded-3xl p-7">
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                        <step.icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <span className="text-5xl font-semibold text-muted">0{i + 1}</span>
                    </div>
                    <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                      {step.label}
                    </h3>
                    <p className="mt-2 text-xl font-semibold tracking-tight">{step.title}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="scroll-mt-20 bg-muted/50 py-20 md:py-28">
          <div className="container px-4 md:px-8">
            <Reveal className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything your care needs, in one app
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Built with clinicians, designed for real Nigerian healthcare journeys.
              </p>
            </Reveal>

            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal as="li" key={f.title} delay={(i % 3) * 90}>
                  <div className="h-full rounded-3xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-luxury">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                      <f.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="scroll-mt-20 py-20 md:py-28">
          <div className="container grid gap-12 px-4 md:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal>
              <div className="overflow-hidden rounded-[2rem] shadow-luxury">
                <img
                  src={doctorImage}
                  alt="A licensed Nigerian doctor speaking with a patient during an online video consultation"
                  width={1200}
                  height={912}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            </Reveal>

            <Reveal delay={100}>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Care you can verify, privacy you can trust
              </h2>
              <ul className="mt-8 space-y-6">
                <li className="flex gap-4">
                  <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">Verified, licensed doctors</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Every clinician's licence and credentials are reviewed before they can consult.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <Lock className="mt-0.5 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">Your records stay yours</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Encrypted in transit and access-controlled, so only you and your treating clinicians can see them.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <Pill className="mt-0.5 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">Registered pharmacy partners</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Medication is fulfilled by licensed pharmacies dispensing genuine, regulator-approved products.
                      <em className="block text-xs">(Placeholder wording — confirm your NAFDAC/PCN compliance claim.)</em>
                    </p>
                  </div>
                </li>
              </ul>

              <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-secondary/50 p-4">
                    <dt className="sr-only">{s.label}</dt>
                    <dd>
                      <span className="block text-2xl font-semibold tracking-tight">{s.value}</span>
                      <span className="mt-1 block text-xs leading-snug text-muted-foreground">{s.label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">Placeholder figures — replace with your verified numbers.</p>
            </Reveal>
          </div>
        </section>

        {/* Testimonials */}
        <section id="stories" className="scroll-mt-20 bg-muted/50 py-20 md:py-28">
          <div className="container px-4 md:px-8">
            <Reveal className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">What patients say</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Placeholder stories — replace with real, consented patient testimonials.
              </p>
            </Reveal>
            <ul className="mt-12 grid gap-5 md:grid-cols-3">
              {TESTIMONIALS.map((t, i) => (
                <Reveal as="li" key={t.name} delay={i * 90}>
                  <figure className="h-full rounded-3xl border border-border/70 bg-card p-7">
                    <blockquote className="text-base leading-relaxed">“{t.quote}”</blockquote>
                    <figcaption className="mt-6 text-sm font-semibold">
                      {t.name}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t.meta}</span>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-20 md:py-28">
          <div className="container grid gap-10 px-4 md:px-8 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h2>
              <p className="mt-4 text-muted-foreground">
                Still unsure? Reach out and our team will help.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-base font-semibold">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-8 md:py-16">
          <div className="container px-4 md:px-8">
            <Reveal>
              <div className="bg-hero-gradient relative overflow-hidden rounded-[2.5rem] px-6 py-16 text-center md:px-16 md:py-20">
                <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-secondary sm:text-4xl md:text-5xl">
                  Your next doctor's appointment is one message away
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base text-secondary/80 md:text-lg">
                  Join Sanari AI today — describe how you feel, speak to a licensed doctor,
                  and get your medication delivered.
                </p>
                <Button asChild size="lg" className="mt-8 bg-accent text-accent-foreground shadow-glow-coral hover:bg-accent/90">
                  <Link to="/auth">
                    Create your free account <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-14">
        <div className="container px-4 md:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <img src={logo} alt="Sanari AI logo" className="h-8 w-auto" width={120} height={32} loading="lazy" />
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                Ask · Assess · Act. AI-assisted healthcare, licensed doctors and pharmacy
                delivery for Nigeria.
              </p>
            </div>
            <nav aria-label="Product">
              <h3 className="text-sm font-semibold">Product</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li><a className="hover:text-foreground" href="#how-it-works">How it works</a></li>
                <li><a className="hover:text-foreground" href="#services">Services</a></li>
                <li><a className="hover:text-foreground" href="#faq">FAQ</a></li>
                <li><Link className="hover:text-foreground" to="/auth">Sign in</Link></li>
              </ul>
            </nav>
            <nav aria-label="Company">
              <h3 className="text-sm font-semibold">Company</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li><a className="hover:text-foreground" href="#trust">Why Sanari</a></li>
                <li><a className="hover:text-foreground" href="#stories">Patient stories</a></li>
                <li><span>Privacy policy (coming soon)</span></li>
                <li><span>Terms of service (coming soon)</span></li>
              </ul>
            </nav>
            <div>
              <h3 className="text-sm font-semibold">Contact</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>hello@sanari.ai <em className="text-xs">(placeholder)</em></li>
                <li>+234 000 000 0000 <em className="text-xs">(placeholder)</em></li>
                <li>Lagos, Nigeria <em className="text-xs">(placeholder)</em></li>
              </ul>
              <ul className="mt-5 flex gap-3">
                {["X", "IG", "LI"].map((s) => (
                  <li key={s}>
                    <a
                      href="#"
                      aria-label={`Sanari AI on ${s} (placeholder link)`}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs font-semibold hover:border-accent hover:text-accent"
                    >
                      {s}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-12 border-t border-border/60 pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Sanari AI. Sanari AI provides health information
            and access to licensed clinicians; it does not replace emergency medical care.
          </p>
        </div>
      </footer>
    </div>
  );
}
