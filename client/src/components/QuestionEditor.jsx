import React, { useState } from 'react'
import { Pencil, X } from 'lucide-react'

// Éditeur de questions utilisé dans la SalleAttente avant le lancement
export default function QuestionEditor({ questions, onChange }) {
  const [newQ, setNewQ] = useState({ question: '', reponse: '', points: 1 })
  const [editIndex, setEditIndex] = useState(null)
  const [editVal, setEditVal] = useState({})

  function addQuestion(e) {
    e.preventDefault()
    if (!newQ.question.trim()) return
    onChange([...questions, { ...newQ, question: newQ.question.trim(), reponse: newQ.reponse.trim() }])
    setNewQ({ question: '', reponse: '', points: 1 })
  }

  function removeQuestion(i) {
    onChange(questions.filter((_, idx) => idx !== i))
  }

  function startEdit(i) {
    setEditIndex(i)
    setEditVal({ ...questions[i] })
  }

  function saveEdit(i) {
    const updated = questions.map((q, idx) => idx === i ? { ...editVal, question: editVal.question.trim(), reponse: editVal.reponse.trim() } : q)
    onChange(updated)
    setEditIndex(null)
  }

  function moveUp(i) {
    if (i === 0) return
    const arr = [...questions]
    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    onChange(arr)
  }

  function moveDown(i) {
    if (i === questions.length - 1) return
    const arr = [...questions]
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    onChange(arr)
  }

  return (
    <div className="space-y-4">
      {/* Liste des questions */}
      {questions.length > 0 ? (
        <ol className="space-y-2">
          {questions.map((q, i) => (
            <li key={i} className="bg-gray-800 rounded-xl p-4">
              {editIndex === i ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editVal.question}
                    onChange={e => setEditVal(v => ({ ...v, question: e.target.value }))}
                    placeholder="Question"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editVal.reponse}
                      onChange={e => setEditVal(v => ({ ...v, reponse: e.target.value }))}
                      placeholder="Réponse attendue (optionnel)"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                    <input
                      type="number" min={1} max={10}
                      value={editVal.points}
                      onChange={e => setEditVal(v => ({ ...v, points: Number(e.target.value) }))}
                      className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-purple-500"
                      title="Points"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(i)} className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-1.5 rounded-lg">
                      Enregistrer
                    </button>
                    <button onClick={() => setEditIndex(null)} className="text-gray-400 hover:text-white text-sm px-3 py-1.5">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xs text-gray-500 font-mono mt-0.5 shrink-0">Q{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{q.question}</p>
                      {q.reponse && <p className="text-xs text-green-400 mt-0.5">→ {q.reponse}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">
                      {q.points}pt
                    </span>
                    <button onClick={() => moveUp(i)} disabled={i === 0} className="text-gray-500 hover:text-white disabled:opacity-20 px-1 py-1 text-xs">↑</button>
                    <button onClick={() => moveDown(i)} disabled={i === questions.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20 px-1 py-1 text-xs">↓</button>
                    <button onClick={() => startEdit(i)} className="text-gray-400 hover:text-purple-400 px-1.5 py-1 text-xs"><Pencil size={12} /></button>
                    <button onClick={() => removeQuestion(i)} className="text-gray-400 hover:text-red-400 px-1.5 py-1 text-xs"><X size={12} /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-gray-500 text-sm italic text-center py-4">
          Aucune question — la partie se jouera sans liste de questions prédéfinies.
        </p>
      )}

      {/* Formulaire d'ajout */}
      <form onSubmit={addQuestion} className="bg-gray-800/50 rounded-xl p-4 border border-dashed border-gray-700 space-y-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Ajouter une question</p>
        <input
          type="text"
          value={newQ.question}
          onChange={e => setNewQ(v => ({ ...v, question: e.target.value }))}
          placeholder="Question *"
          maxLength={300}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newQ.reponse}
            onChange={e => setNewQ(v => ({ ...v, reponse: e.target.value }))}
            placeholder="Réponse attendue (optionnel)"
            maxLength={200}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
          />
          <input
            type="number" min={1} max={10}
            value={newQ.points}
            onChange={e => setNewQ(v => ({ ...v, points: Number(e.target.value) }))}
            className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-purple-500"
            title="Points"
          />
        </div>
        <button
          type="submit"
          disabled={!newQ.question.trim()}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Ajouter
        </button>
      </form>
    </div>
  )
}
