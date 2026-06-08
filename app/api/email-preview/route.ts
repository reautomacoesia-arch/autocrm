/**
 * GET /api/email-preview
 * Renderiza o template de e-mail no browser — apenas para visualização.
 * Remova este arquivo antes de ir para produção.
 */
import { NextResponse } from 'next/server'

const APP_URL = 'https://autocrm-olive.vercel.app'

function htmlTemplate(
  title: string,
  lines: string[],
  ctaLabel?: string,
  ctaPath?: string,
): string {
  const ctaBlock =
    ctaLabel && ctaPath
      ? `<div style="margin-top:20px;">
           <a href="${APP_URL}${ctaPath}"
              style="display:inline-block;padding:10px 22px;background:#4f46e5;color:#fff;
                     border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
             ${ctaLabel} →
           </a>
         </div>`
      : ''

  const bodyLines = lines
    .filter(Boolean)
    .map(l => `<p style="margin:5px 0;color:#94a3b8;font-size:14px;line-height:1.55;">${l}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#0a0a0b;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#111113;
              border:1px solid #1e293b;border-radius:12px;padding:32px;">

    <p style="margin:0 0 20px;font-size:10px;font-weight:700;
              letter-spacing:.15em;text-transform:uppercase;color:#6366f1;">
      KORVUS CRM · AUTOMAÇÃO
    </p>

    <h2 style="margin:0 0 16px;font-size:19px;font-weight:700;color:#f8fafc;">
      ${title}
    </h2>

    <div style="background:#0d0d0f;border:1px solid #1e293b;
                border-radius:8px;padding:14px 16px;margin-bottom:4px;">
      ${bodyLines}
    </div>

    ${ctaBlock}

    <hr style="margin:24px 0;border:none;border-top:1px solid #1e293b;" />
    <p style="margin:0;color:#334155;font-size:11px;">
      Enviado automaticamente pelo Korvus CRM ·
      <a href="${APP_URL}/automations" style="color:#475569;text-decoration:underline;">
        Gerenciar automações
      </a>
    </p>
  </div>
</body>
</html>`
}

const EXAMPLES: Record<string, { title: string; lines: string[]; cta: string; path: string }> = {
  task_overdue: {
    title: '🔴 2 tarefas em atraso',
    lines: [
      'As seguintes tarefas estão em atraso há 1+ dia:',
      '• Entregar relatório mensal — <strong style="color:#f87171">3 dias</strong>',
      '• Ligar para Empresa X — <strong style="color:#f87171">1 dia</strong>',
    ],
    cta: 'Ver tarefas',
    path: '/tasks',
  },
  proposal_no_response: {
    title: '⏰ 3 propostas aguardando resposta',
    lines: [
      'As seguintes propostas foram enviadas e não tiveram resposta:',
      '• Agência Criativa — sem resposta há 7+ dias',
      '• Startup XPTO — sem resposta há 9+ dias',
      '• Loja do João — sem resposta há 12+ dias',
    ],
    cta: 'Ver propostas',
    path: '/proposals',
  },
  client_no_contact: {
    title: '🔕 2 clientes sem contato recente',
    lines: [
      'Os seguintes clientes não tiveram interação registrada nos últimos 30 dias:',
      '• Empresa Alpha — sem contato há 30+ dias',
      '• Consultoria Beta — sem contato há 30+ dias',
    ],
    cta: 'Ver clientes',
    path: '/clients',
  },
  lead_won: {
    title: '🏆 Novo cliente: Agência Criativa',
    lines: [
      'O lead <strong style="color:#f8fafc">Agência Criativa</strong> foi convertido em cliente.',
      'Tarefa de onboarding criada automaticamente.',
    ],
    cta: 'Ver cliente',
    path: '/clients',
  },
  proposal_approved: {
    title: '✅ Proposta aprovada',
    lines: [
      'Uma proposta foi marcada como <strong style="color:#f8fafc">aprovada</strong>.',
      'Tarefa de follow-up criada automaticamente.',
    ],
    cta: 'Ver proposta',
    path: '/proposals',
  },
  lead_lost: {
    title: '❌ Lead perdido: Startup XPTO',
    lines: [
      'O lead <strong style="color:#f8fafc">Startup XPTO</strong> foi marcado como perdido.',
      'Nota registrada: Lead perdido. Retomar contato em 90 dias.',
    ],
    cta: 'Ver pipeline',
    path: '/pipeline',
  },
  client_churned: {
    title: '⚠️ Cliente inativo: Loja do João',
    lines: [
      'O cliente <strong style="color:#f8fafc">Loja do João</strong> foi marcado como inativo ou churned.',
      'Tarefa de reengajamento criada automaticamente.',
    ],
    cta: 'Ver cliente',
    path: '/clients',
  },
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'task_overdue'
  const ex = EXAMPLES[type] ?? EXAMPLES.task_overdue

  // Lista de exemplos disponíveis
  const nav = Object.keys(EXAMPLES)
    .map(k => `<a href="?type=${k}" style="
      display:inline-block;margin:4px;padding:6px 12px;border-radius:6px;
      font-size:12px;text-decoration:none;font-family:sans-serif;
      background:${k === type ? '#4f46e5' : '#1e293b'};
      color:${k === type ? '#fff' : '#94a3b8'};
    ">${k}</a>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Preview de E-mail — Korvus CRM</title></head>
<body style="background:#050505;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="font-family:sans-serif;color:#475569;font-size:12px;margin-bottom:12px;">
      <strong style="color:#6366f1">PREVIEW</strong> — escolha um exemplo:
    </p>
    <div style="margin-bottom:24px;">${nav}</div>
    ${htmlTemplate(ex.title, ex.lines, ex.cta, ex.path)}
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
