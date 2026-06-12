# Spec: Script único para rodar autocrm + gerador_propostas

## Contexto

O monorepo tem dois apps Next.js separados: `autocrm` (raiz, porta 3000) e `gerador_propostas` (porta 3002), que se comunicam via integração de propostas (`external_id`/`external_url`, sync via Supabase).

Hoje, para desenvolver/depurar essa integração, é preciso abrir 2 terminais e iniciar cada app manualmente. Isso dificulta acompanhar logs e erros dos dois lados ao mesmo tempo.

**Decisão aprovada:** não fundir os apps nem os bancos (risco alto: versões divergentes de Next/Tailwind, bancos Supabase separados). Apenas adicionar um comando único de desenvolvimento que sobe os dois processos em um terminal, com logs intercalados e identificados.

---

## 1. Dependência

Adicionar `concurrently` como devDependency no `package.json` da raiz (`autocrm`).

## 2. Script `dev:all`

Novo script em `autocrm/package.json`:

```json
"dev:all": "concurrently -n autocrm,gerador -c blue,magenta \"next dev\" \"npm --prefix gerador_propostas run dev -- -p 3002\""
```

- `autocrm` roda `next dev` (porta padrão 3000)
- `gerador_propostas` roda na porta 3002, batendo com `NEXT_PUBLIC_GERADOR_PROPOSTAS_URL` e `NEXT_PUBLIC_APP_URL` já configurados nos `.env.local`
- Cada linha de log é prefixada com `[autocrm]` ou `[gerador]` em cores diferentes
- `Ctrl+C` encerra os dois processos

## 3. O que não muda

- Nenhuma alteração de arquitetura, rotas, bancos de dados ou variáveis de ambiente
- `npm run dev` (autocrm sozinho) e `npm --prefix gerador_propostas run dev` (gerador sozinho) continuam funcionando como hoje

---

## Teste de aceite

1. Rodar `npm install` na raiz (instala `concurrently`)
2. Rodar `npm run dev:all`
3. Confirmar que `http://localhost:3000` (autocrm) e `http://localhost:3002` (gerador) respondem
4. Confirmar que os logs de ambos aparecem no mesmo terminal, prefixados `[autocrm]`/`[gerador]`
5. `Ctrl+C` encerra ambos os processos
