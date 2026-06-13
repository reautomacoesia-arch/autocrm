'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Controla a abertura de um modal de criação via querystring `?new=1`
 * (ex.: vindo do launcher de comandos). Inicia aberto se `?new=1` estiver
 * presente e limpa o parâmetro da URL uma única vez, para não reabrir o
 * modal em navegações futuras.
 */
export function useNewParamModal(path: string): [boolean, Dispatch<SetStateAction<boolean>>] {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(() => searchParams.get('new') === '1')

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      router.replace(path)
    }
  }, [searchParams, router, path])

  return [isOpen, setIsOpen]
}
