import { Link } from 'react-router-dom';

export function InfoPage({
  title,
  subtitle,
  sections,
}: {
  title: string;
  subtitle: string;
  sections: Array<{ heading: string; body: string }>;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className="space-y-5">
          {sections.map((s) => (
            <div key={s.heading}>
              <h2 className="text-base font-bold text-slate-900">{s.heading}</h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-slate-100">
          <Link to="/account/support" className="text-xs font-bold text-[#0D63F3] hover:underline">
            Need further assistance? Open a Support Ticket →
          </Link>
        </div>
      </div>
    </div>
  );
}
