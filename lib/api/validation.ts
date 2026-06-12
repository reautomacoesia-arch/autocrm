import { z } from 'zod'
import { NextResponse } from 'next/server'

type ParseResult<S extends z.ZodTypeAny> =
  | { ok: true; data: z.infer<S> }
  | { ok: false; response: NextResponse }

/**
 * Lê e valida o corpo JSON de uma request contra um schema Zod.
 * Retorna { ok: false, response } com 400 se o JSON for inválido
 * ou não bater com o schema.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<ParseResult<S>> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }),
    }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Dados inválidos.',
          issues: result.error.issues.map(
            (i) => `${i.path.join('.') || 'body'}: ${i.message}`
          ),
        },
        { status: 400 }
      ),
    }
  }

  return { ok: true, data: result.data }
}
