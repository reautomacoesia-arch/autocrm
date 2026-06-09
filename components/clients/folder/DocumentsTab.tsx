'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Check, Download, Eye, File, FileSpreadsheet, FileText,
  ImageIcon, Loader2, Pencil, Trash2, Upload, X,
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface ClientDocument {
  id: string
  name: string
  size: number
  mime_type: string
  description: string | null
  created_at: string
}

interface UploadingFile {
  name: string
  progress: number
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

function isPreviewable(mime: string): boolean {
  return mime.startsWith('image/') || mime === 'application/pdf'
}

function fileIcon(mime: string) {
  if (mime.includes('pdf'))   return <FileText size={18} className="text-red-400" />
  if (mime.includes('image')) return <ImageIcon size={18} className="text-blue-400" />
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv'))
    return <FileSpreadsheet size={18} className="text-emerald-400" />
  if (mime.includes('word') || mime.includes('document'))
    return <FileText size={18} className="text-blue-300" />
  return <File size={18} className="text-slate-400" />
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Modal de preview ────────────────────────────────────────────────────────
interface PreviewModalProps {
  doc: ClientDocument
  clientId: string
  onClose: () => void
  onDownload: (doc: ClientDocument) => void
}

function PreviewModal({ doc, clientId, onClose, onDownload }: PreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clients/${clientId}/documents/${doc.id}?preview=true`)
      .then((r) => r.json())
      .then((d) => { setUrl(d.url); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clientId, doc.id])

  // Fecha com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
    >
      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-[#111113] flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          {fileIcon(doc.mime_type)}
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{doc.name}</p>
            <p className="text-slate-500 text-xs">{formatSize(doc.size)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <button
            onClick={() => onDownload(doc)}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 rounded-lg px-3 py-1.5 text-xs transition-colors"
          >
            <Download size={13} /> Baixar
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Fechar (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <Loader2 size={32} className="animate-spin text-slate-500" />
        ) : url ? (
          doc.mime_type.startsWith('image/') ? (
            <img
              src={url}
              alt={doc.name}
              className="max-w-full max-h-full object-contain rounded-lg select-none"
              draggable={false}
            />
          ) : (
            // PDF — ocupa toda a área disponível
            <iframe
              src={url}
              title={doc.name}
              className="w-full h-full rounded-lg border-0"
              style={{ minHeight: '70vh' }}
            />
          )
        ) : (
          <p className="text-slate-500 text-sm">Não foi possível carregar o arquivo.</p>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function DocumentsTab({ clientId }: { clientId: string }) {
  const [docs, setDocs] = useState<ClientDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<UploadingFile | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const descInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const confirm = useConfirm()

  useEffect(() => {
    fetch(`/api/clients/${clientId}/documents`)
      .then((r) => r.json())
      .then((d) => { setDocs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    if (editingId) setTimeout(() => descInputRef.current?.focus(), 50)
  }, [editingId])

  async function uploadFile(file: File) {
    const MAX = 500 * 1024 * 1024
    if (file.size > MAX) { toast('Máximo 500 MB por arquivo.', 'error'); return }
    setUploading({ name: file.name, progress: 0 })

    try {
      const presignRes = await fetch(`/api/clients/${clientId}/documents/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, mime_type: file.type || 'application/octet-stream' }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        toast(err.error ?? 'Erro ao preparar upload.', 'error')
        setUploading(null); return
      }

      const { upload_url, r2_key } = await presignRes.json()
      setUploading((p) => p ? { ...p, progress: 10 } : p)

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', upload_url)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 80) + 10
            setUploading((p) => p ? { ...p, progress: pct } : p)
          }
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('Falha de rede'))
        xhr.send(file)
      })

      setUploading((p) => p ? { ...p, progress: 95 } : p)

      const confirmRes = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2_key, name: file.name, size: file.size, mime_type: file.type || 'application/octet-stream' }),
      })
      if (confirmRes.ok) {
        const doc = await confirmRes.json()
        setDocs((prev) => [doc, ...prev])
        toast('Arquivo enviado com sucesso')
      } else {
        toast('Arquivo salvo, mas erro ao registrar no banco.', 'error')
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast('Erro ao enviar arquivo. Verifique a conexão.', 'error')
    }
    setUploading(null)
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) await uploadFile(file)
  }

  async function handleDownload(doc: ClientDocument) {
    const res = await fetch(`/api/clients/${clientId}/documents/${doc.id}`)
    if (res.ok) {
      const { url } = await res.json()
      window.open(url, '_blank')
    } else {
      toast('Erro ao gerar link de download.', 'error')
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
    const res = await fetch(`/api/clients/${clientId}/documents/${doc.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      if (previewDoc?.id === doc.id) setPreviewDoc(null)
      toast('Documento removido')
    } else {
      toast('Erro ao remover documento.', 'error')
    }
  }

  function startEdit(doc: ClientDocument) {
    setEditingId(doc.id)
    setEditingText(doc.description ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingText('')
  }

  async function saveDescription(docId: string) {
    setSavingId(docId)
    const res = await fetch(`/api/clients/${clientId}/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: editingText.trim() || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, description: updated.description } : d))
      toast('Observação salva')
    } else {
      toast('Erro ao salvar observação.', 'error')
    }
    setSavingId(null)
    setEditingId(null)
    setEditingText('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Carregando...
      </div>
    )
  }

  return (
    <>
      <div className="max-w-2xl space-y-4">
        {/* Área de upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl px-6 py-8 flex flex-col items-center gap-3 transition-colors ${
            uploading ? 'cursor-default border-slate-700' :
            dragOver ? 'cursor-copy border-indigo-500 bg-indigo-600/5' :
            'cursor-pointer border-slate-700 hover:border-slate-500'
          }`}
        >
          {uploading ? (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2 justify-center text-slate-400 text-sm">
                <Loader2 size={15} className="animate-spin text-indigo-400" />
                <span className="truncate max-w-xs">{uploading.name}</span>
                <span className="text-indigo-400 font-medium">{uploading.progress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploading.progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload size={24} className="text-slate-500" />
              <div className="text-center">
                <p className="text-slate-300 text-sm font-medium">Arraste arquivos ou clique para selecionar</p>
                <p className="text-slate-600 text-xs mt-1">PDF, Word, Excel, imagens · Máximo 500 MB por arquivo</p>
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
          <p className="text-center text-slate-600 text-sm py-6">Nenhum documento anexado ainda.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs">{docs.length} documento(s)</p>
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="bg-[#1a1a1d] border border-slate-700 rounded-lg overflow-hidden group"
              >
                {/* Linha principal */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Ícone clicável para preview se suportado */}
                  <div
                    className={`flex-shrink-0 ${isPreviewable(doc.mime_type) ? 'cursor-pointer' : ''}`}
                    title={isPreviewable(doc.mime_type) ? 'Visualizar' : undefined}
                    onClick={() => isPreviewable(doc.mime_type) && setPreviewDoc(doc)}
                  >
                    {fileIcon(doc.mime_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-white text-sm font-medium truncate ${isPreviewable(doc.mime_type) ? 'cursor-pointer hover:text-indigo-300 transition-colors' : ''}`}
                      onClick={() => isPreviewable(doc.mime_type) && setPreviewDoc(doc)}
                    >
                      {doc.name}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {formatSize(doc.size)} · {formatDate(doc.created_at)}
                    </p>
                    {doc.description && editingId !== doc.id && (
                      <p className="text-slate-400 text-xs mt-1 italic">{doc.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isPreviewable(doc.mime_type) && (
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        title="Visualizar"
                        className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => editingId === doc.id ? cancelEdit() : startEdit(doc)}
                      title={editingId === doc.id ? 'Cancelar' : 'Adicionar observação'}
                      className={`p-1.5 transition-colors ${editingId === doc.id ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-400'}`}
                    >
                      <Pencil size={14} />
                    </button>
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

                {/* Campo de observação inline */}
                {editingId === doc.id && (
                  <div className="px-4 pb-3 flex items-center gap-2 border-t border-slate-700/50 pt-2.5">
                    <input
                      ref={descInputRef}
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveDescription(doc.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      placeholder="Adicione uma observação sobre este arquivo..."
                      className="flex-1 bg-[#050505] border border-slate-600 focus:border-indigo-500 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none placeholder:text-slate-600"
                      maxLength={300}
                    />
                    <button
                      onClick={() => saveDescription(doc.id)}
                      disabled={savingId === doc.id}
                      title="Salvar"
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                    >
                      {savingId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={cancelEdit}
                      title="Cancelar"
                      className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de preview */}
      {previewDoc && (
        <PreviewModal
          doc={previewDoc}
          clientId={clientId}
          onClose={() => setPreviewDoc(null)}
          onDownload={handleDownload}
        />
      )}
    </>
  )
}
