// Util reaproveitável para exportar relatórios em PDF (tema claro, para impressão/compartilhamento).
// Cliente-side only (usa jspdf + jspdf-autotable).

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── tema ───────────────────────────────────────────────────────────────────────
const KORVUS_GOLD: [number, number, number] = [212, 175, 55]
const TEXT_DARK: [number, number, number] = [26, 26, 29] // #1a1a1d
const TEXT_GRAY: [number, number, number] = [100, 116, 139] // slate-500
const TEXT_MUTED: [number, number, number] = [51, 51, 51] // #333

const PAGE_WIDTH = 210 // A4 retrato, mm
const PAGE_HEIGHT = 297
const MARGIN = 14

// ── tipos auxiliares ──────────────────────────────────────────────────────────
export interface ReportDoc {
  doc: jsPDF
  cursorY: number
}

export interface KpiItem {
  label: string
  value: string
}

// jspdf-autotable anexa `lastAutoTable` à instância do doc em runtime.
interface DocWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number }
}

// ── helpers internos ──────────────────────────────────────────────────────────
function checkPageBreak(report: ReportDoc, neededHeight: number) {
  if (report.cursorY + neededHeight > PAGE_HEIGHT - MARGIN) {
    report.doc.addPage()
    report.cursorY = MARGIN
  }
}

// ── criação do documento ─────────────────────────────────────────────────────
export function newReportDoc(title: string, subtitle?: string): ReportDoc {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Faixa de título dourada
  const bandHeight = 22
  doc.setFillColor(...KORVUS_GOLD)
  doc.rect(0, 0, PAGE_WIDTH, bandHeight, 'F')

  doc.setTextColor(...TEXT_DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('KORVUS CRM', MARGIN, 9)

  doc.setFontSize(15)
  doc.text(title, MARGIN, 17)

  let cursorY = bandHeight + 8

  // Subtítulo (ex.: período) + data de emissão
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...TEXT_GRAY)

  if (subtitle) {
    doc.text(subtitle, MARGIN, cursorY)
    cursorY += 5
  }

  const issuedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  doc.text(`Emitido em ${issuedAt}`, MARGIN, cursorY)
  cursorY += 8

  return { doc, cursorY }
}

// ── grid de KPIs ─────────────────────────────────────────────────────────────
export function addKpiGrid(report: ReportDoc, kpis: KpiItem[]) {
  const { doc } = report
  const columns = 3
  const gap = 4
  const cellWidth = (PAGE_WIDTH - 2 * MARGIN - gap * (columns - 1)) / columns
  const cellHeight = 20

  const rows = Math.ceil(kpis.length / columns)
  const totalHeight = rows * (cellHeight + gap) - gap + 6

  checkPageBreak(report, totalHeight)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_DARK)
  doc.text('Indicadores', MARGIN, report.cursorY)
  report.cursorY += 6

  kpis.forEach((kpi, i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = MARGIN + col * (cellWidth + gap)
    const y = report.cursorY + row * (cellHeight + gap)

    doc.setFillColor(248, 248, 246)
    doc.setDrawColor(...KORVUS_GOLD)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, cellWidth, cellHeight, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_GRAY)
    doc.text(kpi.label, x + 3, y + 6, { maxWidth: cellWidth - 6 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...TEXT_DARK)
    doc.text(kpi.value, x + 3, y + 15, { maxWidth: cellWidth - 6 })
  })

  report.cursorY += rows * (cellHeight + gap) - gap + 8
}

// ── seção com tabela ─────────────────────────────────────────────────────────
export function addSection(
  report: ReportDoc,
  heading: string,
  head: string[],
  body: (string | number)[][],
) {
  const { doc } = report

  checkPageBreak(report, 20)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_DARK)
  doc.text(heading, MARGIN, report.cursorY)
  report.cursorY += 4

  if (body.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_GRAY)
    doc.text('Sem dados para o período selecionado.', MARGIN, report.cursorY + 4)
    report.cursorY += 10
    return
  }

  autoTable(doc, {
    startY: report.cursorY,
    margin: { left: MARGIN, right: MARGIN },
    head: [head],
    body,
    theme: 'striped',
    styles: {
      fontSize: 9,
      textColor: TEXT_MUTED,
      lineColor: [230, 230, 230],
    },
    headStyles: {
      fillColor: KORVUS_GOLD,
      textColor: TEXT_DARK,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 248, 240],
    },
  })

  const finalY = (doc as DocWithAutoTable).lastAutoTable?.finalY ?? report.cursorY
  report.cursorY = finalY + 8
}

// ── salvar arquivo ────────────────────────────────────────────────────────────
export function saveReportDoc(report: ReportDoc, filename: string) {
  const stamp = new Date().toISOString().slice(0, 10)
  report.doc.save(`${filename}-${stamp}.pdf`)
}
