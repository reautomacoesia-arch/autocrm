import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global do next/navigation para componentes client que usam os hooks de
// navegação (useRouter/useSearchParams/usePathname). Testes individuais podem
// sobrescrever com seu próprio vi.mock quando precisarem de comportamento específico.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock global de fetch: componentes client buscam dados ao montar (ex.: /api/profiles)
// com URLs relativas, que o jsdom não consegue resolver. Devolve resposta vazia por
// padrão para os testes de render não quebrarem. Testes específicos podem sobrescrever.
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
    text: () => Promise.resolve(''),
  } as Response)
) as unknown as typeof fetch

// Mock global do cliente Supabase (browser). Componentes client criam o cliente ao
// montar (ex.: ler perfil/preferências). Query builder encadeável que resolve vazio.
vi.mock('@/lib/supabase/client', () => {
  const makeQuery = () => {
    const q: Record<string, unknown> = {}
    const chain = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'or', 'is', 'gte', 'lte', 'order', 'limit']
    for (const m of chain) q[m] = () => q
    q.single = () => Promise.resolve({ data: null, error: null })
    q.maybeSingle = () => Promise.resolve({ data: null, error: null })
    q.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: [], error: null })
    return q
  }
  return {
    createClient: () => ({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => makeQuery(),
    }),
  }
})
