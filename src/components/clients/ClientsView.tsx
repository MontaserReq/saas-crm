'use client';

import { useState } from 'react';
import { createClientAction } from '@/server/actions/crm';

export function ClientsView({ clients, initialSearch }: { clients: any[]; initialSearch: string }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  async function create() {
    const result = await createClientAction({ name, type: 'OTHER' });
    if (result.success) { setName(''); setMessage('Client created'); window.location.reload(); }
    else setMessage(result.error || 'Unable to create client');
  }
  return <main className="p-6 space-y-6">
    <div><h1 className="text-2xl font-bold">Clients</h1><p className="text-sm text-slate-500">Generic organizations and accounts served by this CRM.</p></div>
    <form className="flex gap-2" action="/clients"><input name="search" defaultValue={initialSearch} placeholder="Search clients" className="rounded border px-3 py-2" /><button className="rounded bg-slate-900 px-4 py-2 text-white">Search</button></form>
    <div className="flex gap-2"><input value={name} onChange={e => setName(e.target.value)} placeholder="New client name" className="rounded border px-3 py-2" /><button onClick={create} disabled={!name.trim()} className="rounded bg-brand-600 px-4 py-2 text-white">Add client</button>{message && <span className="text-sm self-center">{message}</span>}</div>
    <div className="overflow-x-auto rounded border"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Contacts</th><th className="p-3">Tickets</th></tr></thead><tbody>{clients.map(client => <tr key={client.id} className="border-b"><td className="p-3 font-medium">{client.name}</td><td className="p-3">{client.type}</td><td className="p-3">{client.status}</td><td className="p-3">{client._count?.contacts ?? 0}</td><td className="p-3">{client._count?.tickets ?? 0}</td></tr>)}</tbody></table></div>
  </main>;
}
