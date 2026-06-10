import React, { useState, useRef } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Upload, AlertCircle, CheckCircle, FileText, X, Image, Loader2, FolderArchive } from 'lucide-react'

const CSV_TEMPLATE = `enonce,type,reponse,explication,difficulte,points,tempsLimite,categorie,choixA,choixB,choixC,choixD,mediaFile,audioFile,videoFile,videoUrl,videoDebut,videoFin
"Qui est le premier président de Côte d'Ivoire ?",BUZZER,"Félix Houphouët-Boigny","Il a gouverné de 1960 à 1993.",FACILE,100,30,Histoire,,,,,,,,,,
"Reconnaissez ce monument d'Abidjan",IMAGE,"La Pyramide","Bâtiment emblématique du Plateau.",MOYEN,150,30,Monuments,,,,,pyramide.jpg,,,,,
"Identifiez cet artiste de coupé-décalé",AUDIO,"DJ Arafat","Légende de la musique ivoirienne.",FACILE,150,25,Musique,,,,,,arafat.mp3,,,,
"Retrouvez ce lieu d'Abidjan en vidéo",VIDEO,"Le Plateau","Quartier des affaires.",MOYEN,200,30,Tourisme,,,,,,,,https://youtube.com/watch?v=xxxxxxxxxxx,0,15`

export default function AdminImport() {
  const { apiFetch, apiUpload } = useAuth()

  // --- Bundle import (CSV + médias) ---
  const csvRef   = useRef(null)
  const mediaRef = useRef(null)
  const zipRef   = useRef(null)
  const packRef  = useRef(null)
  const [csvFile, setCsvFile]     = useState(null)
  const [mediaFiles, setMediaFiles] = useState([])
  const [zipFile, setZipFile]     = useState(null)
  const [packZip, setPackZip]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')

  // Import RICHE (pack visuel) : ZIP { manifest.json + media/ } → choix-images,
  // métadonnées (subjectKey, tags) et création/maj du pack.
  async function runPackImport() {
    if (!packZip) { setError('Sélectionnez un ZIP (manifest.json + media/).'); return }
    setError(''); setResult(null); setLoading(true)
    const fd = new FormData()
    fd.append('zip', packZip)
    const res = await apiUpload('/import/pack', fd)
    if (res?.ok) {
      setResult(await res.json())
      setPackZip(null); if (packRef.current) packRef.current.value = ''
    } else {
      const e = await res?.json().catch(() => null)
      setError(e?.error || 'Échec de l\'import du pack')
    }
    setLoading(false)
  }

  async function runImport() {
    if (!csvFile) { setError('Sélectionnez d\'abord un fichier CSV.'); return }
    setError(''); setResult(null); setLoading(true)
    const fd = new FormData()
    fd.append('csv', csvFile)
    mediaFiles.forEach(f => fd.append('media', f))
    if (zipFile) fd.append('zip', zipFile)
    const res = await apiUpload('/import/questions', fd)
    if (res?.ok) {
      setResult(await res.json())
      setCsvFile(null); setMediaFiles([]); setZipFile(null)
      ;[csvRef, mediaRef, zipRef].forEach(r => { if (r.current) r.current.value = '' })
    } else {
      const e = await res?.json().catch(() => null)
      setError(e?.error || 'Échec de l\'import')
    }
    setLoading(false)
  }

  function downloadTemplate() {
    const blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'template_questions.csv'
    a.click()
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Import en masse</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Importez des questions depuis un CSV. Les colonnes <code>mediaFile</code> / <code>audioFile</code> / <code>videoFile</code>
        {' '}référencent les médias d'un dossier ou d'un ZIP joint (correspondance par nom de fichier).
      </p>

      {/* Template */}
      <div className="card p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={20} style={{ color: '#6366F1' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Modèle CSV</p>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Colonnes attendues, dont les références médias</p>
          </div>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary btn-sm">Télécharger le template</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {/* CSV */}
        <div className="card p-5 cursor-pointer" onClick={() => csvRef.current?.click()}>
          <FileText size={22} style={{ color: '#818CF8', marginBottom: 8 }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>1. Fichier CSV *</p>
          <p className="text-xs mt-1 truncate" style={{ color: csvFile ? '#4ADE80' : 'var(--text-dim)' }}>
            {csvFile ? csvFile.name : 'Aucun fichier'}
          </p>
          <input ref={csvRef} type="file" accept=".csv" className="hidden"
            onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setError('') }} />
        </div>

        {/* Dossier de médias */}
        <div className="card p-5 cursor-pointer" onClick={() => mediaRef.current?.click()}>
          <Image size={22} style={{ color: '#F472B6', marginBottom: 8 }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>2. Dossier de médias</p>
          <p className="text-xs mt-1" style={{ color: mediaFiles.length ? '#4ADE80' : 'var(--text-dim)' }}>
            {mediaFiles.length ? `${mediaFiles.length} fichier(s)` : 'Images / audio / vidéo'}
          </p>
          <input ref={mediaRef} type="file" multiple webkitdirectory="" directory="" className="hidden"
            onChange={e => setMediaFiles(Array.from(e.target.files ?? []))} />
        </div>

        {/* ZIP */}
        <div className="card p-5 cursor-pointer" onClick={() => zipRef.current?.click()}>
          <FolderArchive size={22} style={{ color: '#FCD34D', marginBottom: 8 }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>… ou un ZIP</p>
          <p className="text-xs mt-1 truncate" style={{ color: zipFile ? '#4ADE80' : 'var(--text-dim)' }}>
            {zipFile ? zipFile.name : 'Archive .zip de médias'}
          </p>
          <input ref={zipRef} type="file" accept=".zip" className="hidden"
            onChange={e => setZipFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      <button onClick={runImport} disabled={loading || !csvFile} className="btn-primary w-full gap-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {loading ? 'Import en cours…' : 'Lancer l\'import'}
      </button>

      {/* Import RICHE : pack visuel (drapeaux, logos…) via ZIP + manifest.json */}
      <div className="card p-5 mt-6" style={{ border: '1px dashed var(--border-strong)' }}>
        <div className="flex items-center gap-2 mb-1">
          <FolderArchive size={18} style={{ color: '#A855F7' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Pack visuel — ZIP + manifest.json</p>
        </div>
        <p className="text-2xs mb-3" style={{ color: 'var(--text-dim)' }}>
          Choix-images, métadonnées (<code>subjectKey</code>, <code>tags</code>) et (re)création du pack.
          Le ZIP contient <code>manifest.json</code> + un dossier <code>media/</code>. Voir <code>docs/AUDIT_DRAPEAUX.md</code>.
        </p>
        <div className="flex items-center gap-3">
          <div className="card p-3 cursor-pointer flex-1" onClick={() => packRef.current?.click()}
            style={{ background: 'var(--hover-overlay)' }}>
            <p className="text-xs truncate" style={{ color: packZip ? '#4ADE80' : 'var(--text-dim)' }}>
              {packZip ? packZip.name : 'Sélectionner un .zip (manifest + media)'}
            </p>
            <input ref={packRef} type="file" accept=".zip" className="hidden"
              onChange={e => { setPackZip(e.target.files?.[0] ?? null); setError('') }} />
          </div>
          <button onClick={runPackImport} disabled={loading || !packZip} className="btn-primary btn-sm gap-2 shrink-0">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}Importer le pack
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3 mt-4 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {result && (
        <div className="card p-5 mt-4" style={{ border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.04)' }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} style={{ color: '#4ADE80' }} />
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Import terminé</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Stat label="Questions" value={result.questionsCreated} color="#4ADE80" />
            <Stat label="Médias ajoutés" value={result.mediaIngested} color="#818CF8" />
            <Stat label="Doublons média" value={result.mediaDeduplicated} color="#FCD34D" />
            <Stat label="Erreurs" value={result.errors?.length ?? 0} color="#F87171" />
          </div>
          {result.unmatchedMedia?.length > 0 && (
            <p className="text-xs mt-3" style={{ color: '#FCD34D' }}>
              Médias référencés mais introuvables : {result.unmatchedMedia.slice(0, 10).join(', ')}
              {result.unmatchedMedia.length > 10 ? `… (+${result.unmatchedMedia.length - 10})` : ''}
            </p>
          )}
          {result.errors?.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs cursor-pointer" style={{ color: '#F87171' }}>Voir les erreurs</summary>
              <pre className="text-2xs mt-2 overflow-x-auto p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)' }}>
                {JSON.stringify(result.errors.slice(0, 20), null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </AdminLayout>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-lg py-3" style={{ background: 'var(--hover-overlay)' }}>
      <p className="text-2xl font-black" style={{ color }}>{value ?? 0}</p>
      <p className="text-2xs uppercase tracking-wider mt-1" style={{ color: 'var(--text-dim)' }}>{label}</p>
    </div>
  )
}
