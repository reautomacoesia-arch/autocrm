/**
 * lib/email.ts
 * Wrapper Resend para envio de e-mails de automação do Korvus CRM.
 *
 * Variáveis de ambiente necessárias:
 *   RESEND_API_KEY       — chave da API Resend (resend.com)
 *   NOTIFICATION_EMAIL   — endereço que receberá os alertas (ex: seu@email.com)
 *
 * Variáveis opcionais:
 *   EMAIL_FROM           — remetente (padrão: "Korvus CRM <onboarding@resend.dev>")
 *                          Para produção, use um domínio verificado no Resend.
 *   NEXT_PUBLIC_APP_URL  — URL base do CRM (para links nos e-mails)
 */

import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.EMAIL_FROM ?? 'Korvus CRM <onboarding@resend.dev>'
const TO   = process.env.NOTIFICATION_EMAIL ?? ''
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://autocrm-olive.vercel.app').replace(/\/$/, '')

// ── Template HTML ─────────────────────────────────────────────────────────────

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

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Envia um e-mail de alerta para NOTIFICATION_EMAIL.
 *
 * @param subject  Assunto (prefixado com "[Korvus] " automaticamente)
 * @param lines    Linhas do corpo (aceita HTML inline simples)
 * @param ctaLabel Texto do botão de CTA (opcional)
 * @param ctaPath  Caminho relativo da URL de destino, ex: "/tasks" (opcional)
 */
export async function sendEmail(
  subject: string,
  lines: string[],
  ctaLabel?: string,
  ctaPath?: string,
): Promise<boolean> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY não configurado — e-mail pulado.')
    return false
  }
  if (!TO) {
    console.warn('[email] NOTIFICATION_EMAIL não configurado — e-mail pulado.')
    return false
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [TO],
      subject: `[Korvus] ${subject}`,
      html: htmlTemplate(subject, lines, ctaLabel, ctaPath),
    })

    if (error) {
      console.error('[email] Erro Resend:', error)
      return false
    }

    console.log(`[email] Enviado para ${TO}: ${subject}`)
    return true
  } catch (err) {
    console.error('[email] Falha no envio:', err)
    return false
  }
}
