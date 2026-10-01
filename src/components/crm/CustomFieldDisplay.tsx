export function CustomFieldDisplay({ values = [] }: { values?: any[] }) {
  if (!values.length) return null;
  return <section className="rounded border p-4 lg:col-span-2"><h2 className="font-semibold">Custom fields</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2">{values.map((item) => { const v = item.valueJson ?? item.valueText ?? item.valueNumber ?? item.valueBoolean ?? item.valueDate; return <div key={item.id}><dt className="text-xs text-slate-500">{item.fieldDefinition.label}</dt><dd className="text-sm">{Array.isArray(v) ? v.join(', ') : String(v ?? '—')}</dd></div>; })}</dl></section>;
}
