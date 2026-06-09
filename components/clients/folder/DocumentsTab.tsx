'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, File, FileSpreadsheet, FileText, Image, Loader2, Trash2, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface ClientDocument {
  id: string
  name: string
  size: number
  mime_type: string
  created_at: string
}

const ACCEPTED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
].join(',')

function fileIcon(mime: string) {
  if (mime.includes('pdf')) return <FileText size={18} className="text-red-400" />
  if (mime.includes('image')) return <Image size={18} className="text-blue-400" />
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv'))
    return <FileSpreadsheet size={18} className="text-emerald-400" />
  if (mime.includes('word') || mime.includes('document'))
    return <FileText size={18} className="text-blue-400" />
  return <File size={18} className="text-slate-400" />
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DocumentsTab({ clientId }: { clientId: string }) {
  const [docs, setDocs] = useState<ClientDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const confirm = useConfirm()

  useEffect(() => {
    fetch(`/api/clients/${clientId}/documents`)
      .then((r) => r.json())
      .then((d) => { setDocs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clientId])

  async function uploadFile(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      toast('Arquivo muito grande. Máximo 50 MB.', 'error')
      return
    }
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        body: form,
      })
      if (res.ok) {
        const doc = await res.json()
        setDocs((prev) => [doc, ...prev])
        toast('Arquivo enviado com sucesso')
      } else {
        const body = await res.json().catch(() => ({}))
        toast(body.error ?? 'Erro ao enviar arquivo', 'error')
      }
    } catch {
      toast('Erro de conexão ao enviar arquivo', 'error')
    }
    setUploading(false)
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      await uploadFile(file)
    }
  }

  async function handleDownload(doc: ClientDocument) {
    const res = await fetch(`/api/clients/${clientId}/documents/${doc.id}`)
    if (res.ok) {
      const { url } = await res.json()
      window.open(url, '_blank')
    } else {
      toast('Erro ao gerar link de download', 'error')
    }
  }

  async function handleDelete(doc: ClientDocument) {
    const ok = await confirm({
      title: 'Remover este documento?',
      description: 'O arquivo será excluído permanentemente.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    const res = await fetch(`/api/clients/${clientId}/documents/${doc.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      toast('Documento removido')
    } else {
      toast('Erro ao remover documento', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Carregando...
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Área de upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-6 py-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
          dragOver
            ? 'border-indigo-500 bg-indigo-600/5'
            : 'border-slate-700 hover:border-slate-500'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        {uploading ? (
          <>
            <Loader2 size={24} className="text-indigo-400 animate-spin" />
            <p className="text-slate-400 text-sm">Enviando arquivo...</p>
          </>
        ) : (
          <>
            <Upload size={24} className="text-slate-500" />
            <div className="text-center">
              <p className="text-slate-300 text-sm font-medium">
                Arraste arquivos ou clique para selecionar
              </p>
              <p className="text-slate-600 text-xs mt-1">
                PDF, Word, Excel, imagens · Máximo 50 MB por arquivo
              </p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Lista de documentos */}
      {docs.length === 0 ? (
        <p className="text-center text-slate-600 text-sm py-6">
          Nenhum documento anexado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-slate-500 text-xs">{docs.length} documento(s)</p>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3 group"
            >
              <div className="flex-shrink-0">{fileIcon(doc.mime_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {formatSize(doc.size)} · {formatDate(doc.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(doc)}
                  title="Baixar"
                  className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  title="Remover"
                  className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
