# Spec: Rebrand AutoCRM → KORVUS CRM

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase.

A empresa adotou a marca **KORVUS AI** (brandbook 2025). Este spec aplica a identidade visual da Korvus ao CRM: paleta preto/ouro, tipografia Montserrat/Inter/Roboto Mono, wordmark e ícone do corvo. O brandbook prevê explicitamente: *"A interface do KORVUS AI segue dark mode como padrão, tipografia Montserrat e Inter, e Neural Gold como cor de destaque em todos os elementos de ação e métricas."*

**Decisões aprovadas:**
- Nome na UI: **KORVUS CRM** (wordmark "KORVUS" + "CRM" como complemento)
- Logo: ícone do corvo (`public/korvus-icon.png`, já copiado) — PNG preto/dourado que funde com o fundo
- CTAs: **Neural Gold com texto preto** (premium)

---

## 1. Paleta Korvus (brandbook §05)

| Nome | Hex | RGB | Uso |
|---|---|---|---|
| KORVUS BLACK | `#050505` | 5,5,5 | Fundos |
| OBSIDIAN GREY | `#1A1A1D` | 26,26,29 | Cards/superfícies |
| NEURAL GOLD | `#D4AF37` | 212,175,55 | Destaque, CTAs, ícones, métricas |
| PHANTOM WHITE | `#F8F9FA` | 248,249,250 | Textos e títulos |

### Estratégia técnica

O codebase usa classes Tailwind hardcoded em ~35 arquivos. Em vez de reescrever todos, usamos **Tailwind v4 `@theme`** para remapear as escalas `indigo` (destaque) e `slate` (neutros) para as cores Korvus. Isso reskina automaticamente todas as classes `bg-indigo-600`, `text-slate-400`, `border-slate-700` etc. Os 2 hexes de fundo arbitrários (`#0f172a`, `#1e293b`) são substituídos globalmente.

Contagem de uso atual (referência): `slate-700` 199×, `slate-400` 190×, `indigo-500` 158×, `#0f172a` 89×, `slate-500` 86×, `#1e293b` 79×, `indigo-600` 44×, `indigo-400` 25×.

---

## 2. `app/globals.css` — reescrita completa

```css
@import "tailwindcss";

/* ── Paleta Korvus (brandbook §05) ───────────────────────────────── */
:root {
  --korvus-black: #050505;
  --obsidian: #1a1a1d;
  --neural-gold: #d4af37;
  --phantom-white: #f8f9fa;

  --background: var(--korvus-black);
  --foreground: var(--phantom-white);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  /* Fontes */
  --font-sans: var(--font-inter);
  --font-display: var(--font-montserrat);
  --font-mono: var(--font-roboto-mono);

  /* ── Destaque: escala indigo → Neural Gold ──────────────────────── */
  --color-indigo-300: #e9d9a6;
  --color-indigo-400: #dfc367;
  --color-indigo-500: #d4af37;  /* Neural Gold */
  --color-indigo-600: #cba62f;
  --color-indigo-700: #a8852a;
  --color-indigo-800: #3d3214;
  --color-indigo-900: #2a2310;

  /* ── Neutros: escala slate → tons Korvus ────────────────────────── */
  --color-slate-100: #f8f9fa;  /* Phantom White */
  --color-slate-200: #e5e5e7;
  --color-slate-300: #c9c9ce;
  --color-slate-400: #8a8a93;
  --color-slate-500: #6e6e77;
  --color-slate-600: #4a4a52;
  --color-slate-700: #2a2a2f;
  --color-slate-800: #1f1f23;
  --color-slate-900: #0a0a0c;

  /* ── Emerald/amber/red mantêm os defaults do Tailwind ──────────── */
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-inter), system-ui, sans-serif;
}

/* Títulos em Montserrat (não forçar uppercase — nomes de clientes
   são dinâmicos; uppercase fica só no wordmark e labels já-uppercase) */
h1, h2, h3, h4 {
  font-family: var(--font-montserrat), system-ui, sans-serif;
}
```

**Notas:**
- `emerald`, `amber`, `red`, `green`, `blue`, `yellow` (usados em badges de status/valores positivos) mantêm os defaults do Tailwind — funcionam bem sobre o fundo preto e dão contraste semântico (verde = recebido, vermelho = atrasado, etc.).
- O remap de `indigo`/`slate` cobre ~95% do rebrand sem tocar componentes.

---

## 3. Substituição dos hexes de fundo

Substituir globalmente em todos os `.tsx` de `app/` e `components/`:
- `#0f172a` → `#050505` (Korvus Black)
- `#1e293b` → `#1a1a1d` (Obsidian Grey)

Estes aparecem sempre como cores de fundo (`bg-[#0f172a]`, `bg-[#1e293b]`), então a substituição é segura e mecânica.

---

## 4. Botões CTA — texto preto sobre dourado

Após o remap, `bg-indigo-600` renderiza Neural Gold. Os botões primários hardcodam `text-white`, que precisa virar preto para o look premium.

**Regra:** em cada className que contém `bg-indigo-600` como cor sólida (seguido de espaço, aspas ou crase — **não** `/opacidade`), trocar o token `text-white` por `text-[#050505]`.

Padrões afetados (botões primários): `bg-indigo-600 hover:bg-indigo-500 ... text-white`. Botões com `bg-indigo-600/20` (item ativo do sidebar, chips) **não** são afetados (têm `/`).

Implementação via script Python que processa linha-a-linha: se a linha contém `bg-indigo-600` seguido de espaço/aspas/crase, substitui ` text-white` por ` text-[#050505]` naquela linha.

```python
import re, pathlib

ROOT = pathlib.Path('.')
for f in list(ROOT.glob('app/**/*.tsx')) + list(ROOT.glob('components/**/*.tsx')):
    lines = f.read_text(encoding='utf-8').split('\n')
    changed = False
    for i, line in enumerate(lines):
        # bg-indigo-600 sólido (não /opacidade)
        if re.search(r'bg-indigo-600(?=[\s"\'`])', line) and 'text-white' in line:
            lines[i] = line.replace('text-white', 'text-[#050505]')
            changed = True
    if changed:
        f.write_text('\n'.join(lines), encoding='utf-8')
        print(f'updated {f}')
```

Revisar o diff depois para garantir que só botões dourados sólidos foram afetados.

---

## 5. Fontes — `app/layout.tsx`

Adicionar Montserrat e Roboto Mono (Inter já existe). Usar variáveis CSS para o `@theme` referenciar.

```tsx
import type { Metadata } from 'next'
import { Inter, Montserrat, Roboto_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '700', '800', '900'],
  variable: '--font-montserrat',
})
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' })

export const metadata: Metadata = {
  title: 'KORVUS CRM',
  description: 'Inteligência que adapta. Automação que escala.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${montserrat.variable} ${robotoMono.variable} ${inter.className} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
```

---

## 6. Sidebar — wordmark e ícone do corvo

### Arquivo
- **Modificar:** `components/layout/Sidebar.tsx`

Substituir o bloco do logo (caixa indigo com ícone Zap + "AutoCRM") por: o ícone do corvo + wordmark "KORVUS" (Montserrat, caixa alta) + "CRM" como complemento dourado.

```tsx
import Image from 'next/image'
// ... demais imports

{/* Logo */}
<div className="px-4 py-5 border-b border-slate-700">
  <div className="flex items-center gap-2.5">
    <div className="w-8 h-8 rounded-md overflow-hidden bg-black flex-shrink-0">
      <Image src="/korvus-icon.png" alt="Korvus" width={32} height={32} className="w-full h-full object-cover" />
    </div>
    <div className="leading-none">
      <span className="block text-white font-display font-extrabold text-sm tracking-wider uppercase">
        Korvus
      </span>
      <span className="block text-[#d4af37] text-[10px] font-medium tracking-[0.2em] uppercase mt-0.5">
        CRM
      </span>
    </div>
  </div>
</div>
```

Onde `font-display` resolve para Montserrat (via `@theme`). O ícone fica em um container `bg-black` arredondado para fundir com o PNG preto.

---

## 7. Métricas em Roboto Mono

### Arquivos
- **Modificar:** `components/dashboard/MetricCard.tsx`

O brandbook reserva Roboto Mono para métricas/valores numéricos em dashboards. Aplicar `font-mono` (que resolve para Roboto Mono via `@theme`) ao valor numérico do MetricCard.

Localizar o elemento que exibe o `value` do card e adicionar `font-mono` à sua className. Ex: se o valor está em `<p className="text-2xl font-bold ...">`, passa a `<p className="text-2xl font-bold font-mono ...">`.

> Escopo: apenas o `MetricCard` (a principal superfície de métricas do dashboard). Demais valores financeiros podem receber `font-mono` em iterações futuras; não é necessário para este rebrand.

---

## 8. Strings "AutoCRM" → "Korvus"

Procurar ocorrências literais de "AutoCRM" em `app/` e `components/` e substituir:
- `metadata.title` → "KORVUS CRM" (já no item 5)
- Sidebar wordmark → tratado no item 6
- Qualquer outra string visível (ex: página de login, se houver) → "KORVUS" ou "KORVUS CRM" conforme contexto

Verificar via `grep -ri "autocrm" app components` e ajustar cada ocorrência visível ao usuário.

---

## 9. Favicon (opcional, baixo esforço)

Se houver `app/favicon.ico` ou ícone de app, pode ser substituído pelo corvo numa iteração futura. Não bloqueia este rebrand.

---

## Regras técnicas

- Tailwind v4: overrides de cor em `@theme` afetam todas as utilities daquela escala — confirmado pelo modelo de v4
- Não forçar uppercase global em headings (nomes de clientes são dinâmicos) — uppercase só no wordmark e em labels que já usam `uppercase`
- `emerald`/`amber`/`red` mantêm defaults (semântica de status/valores)
- O PNG do corvo tem fundo preto (#000) — exibido em container `bg-black` arredondado para não destoar
- Sem migration, sem mudança de dados — puramente visual/identidade

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `public/korvus-icon.png` | Já copiado |
| `app/globals.css` | Reescrever — paleta Korvus + remap indigo/slate + fontes + headings Montserrat |
| `app/layout.tsx` | Modificar — adicionar Montserrat + Roboto Mono, metadata KORVUS CRM |
| `components/layout/Sidebar.tsx` | Modificar — ícone do corvo + wordmark KORVUS CRM |
| `components/dashboard/MetricCard.tsx` | Modificar — valor em Roboto Mono (font-mono) |
| Todos os `.tsx` de `app/`+`components/` | Substituir hexes `#0f172a`→`#050505`, `#1e293b`→`#1a1a1d` (script) |
| Botões com `bg-indigo-600` sólido | Trocar `text-white`→`text-[#050505]` (script) |
| Strings "AutoCRM" | Substituir por "KORVUS"/"KORVUS CRM" |
