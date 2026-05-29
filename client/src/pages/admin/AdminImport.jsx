import React, { useState, useRef } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Upload, AlertCircle, CheckCircle, FileText, X } from 'lucide-react'

const CSV_TEMPLATE = `enonce,type,reponse,explication,difficulte,points,tempsLimite,choixA,choixB,choixC,choixD
"Qui est le premier président de Côte d'Ivoire ?",BUZZER,"Félix Houphouët-Boigny","Il a gouverné de 1960 à 1993.",FACILE,100,30,,,,
"Quelle est la capitale du Sénégal ?",QCM,Dakar,"Dakar est la capitale et la plus grande ville.",FACILE,100,30,Dakar,Abidjan,Bamako,Lagos
"La Côte d'Ivoire est le 1er producteur mondial de cacao",VRAI_FAUX,Vrai,"Elle produit ~40% du cacao mondial.",FACILE,50,20,Vrai,Faux,,`

function parseCsv(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQ = !inQ; continue }
      if (c === ',' && !inQ) { vals.push(cur); cur = ''; continue }
      cur += c
    }
    vals.push(cur)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim() })

    const choix = [obj.choixA, obj.choixB, obj.choixC, obj.choixD].filter(Boolean)
    const q = {
      enonce:      obj.enonce,
      type:        obj.type || 'BUZZER',
      reponse:     obj.reponse,
      explication: obj.explication || null,
      difficulte:  obj.difficulte || 'MOYEN',
      points:      Number(obj.points) || 100,
      tempsLimite: Number(obj.tempsLimite) || 30,
      choix,
      publique:    true,
    }
    return q
  }).filter(q => q.enonce && q.reponse)
}

export default function AdminImport() {
  const { apiFetch } = useAuth()
  const fileRef = useRef(null)
  const [preview, setPreview]   = useState(null)
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null); setError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const questions = parseCsv(ev.target.result)
        if (questions.length === 0) { setError('Aucune question valide détectée dans ce fichier.'); return }
        setPreview(questions)
      } catch {
        setError('Erreur de lecture du fichier.')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!preview?.length) return
    setLoading(true); setError('')
    const res = await apiFetch('/questions/import-csv', { method: 'POST', body: { questions: preview } })
    if (res?.ok) {
      const d = await res.json()
      setResult(d)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } else {
      setError('Erreur lors de l\'import')
    }
    setLoading(false)
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'template_questions.csv'
    a.click()
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#ECECF0' }}>Import CSV</h1>
      <p className="text-sm mb-6" style={{ color: '#9090A0' }}>
        Importez des questions en masse depuis un fichier CSV.
      </p>

      {/* Template download */}
      <div className="card p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={20} style={{ color: '#6366F1' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#ECECF0' }}>Modèle CSV</p>
            <p className="text-xs" style={{ color: '#5A5A6E' }}>Téléchargez le template pour connaître la structure attendue</p>
          </div>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary btn-sm gap-2">
          Télécharger le template
        </button>
      </div>

      {/* Upload zone */}
      <div
        className="rounded-xl border-2 border-dashed p-10 text-center mb-4 cursor-pointer transition-all"
        style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.03)' }}
        onClick={() => fileRef.current?.click()}>
        <Upload size={28} style={{ color: '#6366F1', margin: '0 auto 12px' }} />
        <p className="text-sm font-medium mb-1" style={{ color: '#ECECF0' }}>Cliquez pour choisir un fichier CSV</p>
        <p className="text-xs" style={{ color: '#5A5A6E' }}>Format : .csv, encodage UTF-8</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: '#ECECF0' }}>
              Aperçu — {preview.length} question{preview.length !== 1 ? 's' : ''} détectée{preview.length !== 1 ? 's' : ''}
            </p>
            <button onClick={() => setPreview(null)} className="btn-ghost btn-sm"><X size={12} /></button>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
            {preview.slice(0, 20).map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-xs py-1.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-xs font-bold shrink-0 w-5 text-right" style={{ color: '#5A5A6E' }}>{i + 1}</span>
                <span className="text-xs px-1 py-0.5 rounded shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#9090A0' }}>{q.type}</span>
                <span className="flex-1 truncate" style={{ color: '#ECECF0' }}>{q.enonce}</span>
                <span className="shrink-0" style={{ color: '#4ADE80' }}>{q.reponse}</span>
              </div>
            ))}
            {preview.length > 20 && (
              <p className="text-xs text-center py-2" style={{ color: '#5A5A6E' }}>
                … et {preview.length - 20} autre{preview.length - 20 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button onClick={handleImport} disabled={loading} className="btn-primary w-full gap-2">
            {loading ? 'Import en cours…' : `Importer ${preview.length} questions`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card p-5"
          style={{ border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.04)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} style={{ color: '#4ADE80' }} />
            <p className="font-semibold" style={{ color: '#ECECF0' }}>Import terminé</p>
          </div>
          <p className="text-sm" style={{ color: '#4ADE80' }}>{result.created} question{result.created !== 1 ? 's' : ''} importée{result.created !== 1 ? 's' : ''}</p>
          {result.errors?.length > 0 && (
            <p className="text-sm mt-1" style={{ color: '#F87171' }}>{result.errors.length} erreur{result.errors.length !== 1 ? 's' : ''}</p>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
