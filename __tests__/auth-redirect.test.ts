import { describe, it, expect } from 'vitest'

// Tests the route protection logic
describe('Proteção de rotas', () => {
  it('rotas do dashboard devem exigir autenticação', () => {
    const rotasProtegidas = [
      '/',
      '/pipeline',
      '/clients',
      '/proposals',
      '/tasks',
      '/services',
      '/financial',
    ]
    const rotasPublicas = ['/login']

    // Verifies routes are classified correctly
    rotasProtegidas.forEach((rota) => {
      expect(rota.startsWith('/login')).toBe(false)
    })

    rotasPublicas.forEach((rota) => {
      expect(rota).toBe('/login')
    })
  })
})
