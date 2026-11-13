import { PageShell } from '../components/ui';
import { LeadForm } from '../components/LeadForm';
import { useTenant } from '../lib/tenant';

export function ContactPage() {
  const tenant = useTenant();
  const c = tenant?.contact;
  return (
    <PageShell>
      <div className="mx-auto grid max-w-[1200px] gap-16 px-4 pb-24 pt-16 sm:px-8 sm:pt-24 md:grid-cols-2">
        <div>
          <p className="kicker">Холбоо барих</p>
          <h1 className="display-wide mt-4 text-[clamp(2.5rem,6vw,5rem)]">Бидэнтэй холбогдоорой</h1>
          <dl className="mt-12 space-y-6 text-sm">
            {c?.phone && <div><dt className="kicker">Утас</dt><dd className="mt-2"><a className="hover:text-accent" href={`tel:${c.phone}`}>{c.phone}</a></dd></div>}
            {c?.email && <div><dt className="kicker">И-мэйл</dt><dd className="mt-2"><a className="hover:text-accent" href={`mailto:${c.email}`}>{c.email}</a></dd></div>}
            {c?.address && <div><dt className="kicker">Шоурум</dt><dd className="mt-2 text-fg-2">{c.address}</dd></div>}
            {c?.hours && <div><dt className="kicker">Цагийн хуваарь</dt><dd className="mt-2 text-fg-2">{c.hours}</dd></div>}
            {!c?.phone && !c?.email && !c?.address && <p className="text-fg-2">Мэдээллээ үлдээвэл дилер тантай холбогдоно.</p>}
          </dl>
        </div>
        <div className="panel p-6 sm:p-8"><LeadForm type="contact" /></div>
      </div>
    </PageShell>
  );
}
