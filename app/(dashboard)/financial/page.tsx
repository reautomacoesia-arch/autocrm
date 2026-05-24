import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pipeline'

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
  }
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export default async function FinancialPage() {
  const supabase = await createClient()

  const [clientsRes, transactionsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, company, monthly_value')
      .eq('status', 'active')
      .order('monthly_value', { ascending: false }),
    supabase
      .from('transactions')
      .select('*, clients(name, company)')
      .order('date', { ascending: false })
      .limit(50),
  ])

  const clients = clientsRes.data ?? []
  const transactions = transactionsRes.data ?? []

  const mrr = clients.reduce((sum: number, c: any) => sum + (c.monthly_value || 0), 0)
  const totalReceived = transactions
    .filter((t: any) => t.type === 'received')
    .reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0)
  const totalPending = transactions
    .filter((t: any) => t.type === 'pending')
    .reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Financeiro</h1>
        <p className="text-slate-400 text-sm mt-1">Visão geral do fluxo de caixa</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">MRR</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(mrr)}</p>
          <p className="text-slate-500 text-xs mt-1">{clients.length} cliente(s) ativo(s)</p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Total Recebido</p>
          <p className="text-emerald-400 text-2xl font-bold">{formatCurrency(totalReceived)}</p>
          <p className="text-slate-500 text-xs mt-1">
            {transactions.filter((t: any) => t.type === 'received').length} transação(ões)
          </p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Pendente</p>
          <p className="text-amber-400 text-2xl font-bold">{formatCurrency(totalPending)}</p>
          <p className="text-slate-500 text-xs mt-1">
            {transactions.filter((t: any) => t.type === 'pending').length} transação(ões)
          </p>
        </div>
      </div>

      {/* Clients MRR breakdown */}
      {clients.length > 0 && (
        <div className="mb-8">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Receita por Cliente
          </h2>
          <div className="space-y-2">
            {clients.map((client: any) => (
              <div
                key={client.id}
                className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-white text-sm font-medium">{client.name}</p>
                  {client.company && (
                    <p className="text-slate-400 text-xs">{client.company}</p>
                  )}
                </div>
                <p className="text-emerald-400 text-sm font-semibold">
                  {formatCurrency(client.monthly_value)}/mês
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Transações Recentes
          </h2>
          <div className="space-y-2">
            {transactions.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-white text-sm font-medium">{formatCurrency(t.amount)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.clients && (
                      <p className="text-slate-400 text-xs">
                        {t.clients.name}
                        {t.clients.company ? ` — ${t.clients.company}` : ''}
                      </p>
                    )}
                    {t.description && (
                      <p className="text-slate-500 text-xs">· {t.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-slate-500 text-xs">{formatDate(t.date)}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      t.type === 'received'
                        ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
                        : 'bg-amber-900/30 text-amber-400 border-amber-800'
                    }`}
                  >
                    {t.type === 'received' ? 'Recebido' : 'Pendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {transactions.length === 0 && clients.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">
          Nenhuma transação registrada ainda. Registre pagamentos nas pastas dos clientes.
        </div>
      )}
    </div>
  )
}
