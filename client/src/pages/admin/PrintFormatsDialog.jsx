import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RotateCcw, Save, X } from 'lucide-react'
import { api } from '../../lib/api'

/*
 * Admin-only: choose which print layout a user gets.
 *  - "Default for this user" applies to all their reports / bills.
 *  - A bank preset can override it for valuations of that bank.
 * Drafts follow the assignment live; a report keeps the layout it was locked
 * (printed/shared) with, and a sell bill keeps the layout it was created with.
 */

const DOC_SECTIONS = [
  { docType: 'VALUATION', title: 'Valuation report' },
  { docType: 'SELL_BILL', title: 'Sell bill / invoice' },
]

export const shortFormatLabel = (format) => String(format?.label || format?.id || 'Standard').split(' — ')[0]

function OptionsEditor({ format, options, onChange }) {
  const set = (spec, value) => {
    const next = { ...options }
    if (value === spec.default || (spec.type === 'number' && Number(value) === Number(spec.default))) delete next[spec.key]
    else next[spec.key] = value
    onChange(next)
  }
  const changed = Object.keys(options || {}).length
  return (
    <details className="mt-3 rounded-md border border-slate-200 bg-slate-50" open={changed > 0}>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700">
        Customize this format{changed ? ` (${changed} change${changed > 1 ? 's' : ''})` : ''}
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3">
        {format.options.map((spec) => {
          const value = options?.[spec.key] ?? spec.default
          if (spec.type === 'boolean') {
            return (
              <label key={spec.key} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                  checked={Boolean(value)}
                  onChange={(e) => set(spec, e.target.checked)}
                />
                <span className="min-w-0">{spec.label}</span>
              </label>
            )
          }
          return (
            <div key={spec.key} className="min-w-0">
              <label className="label">{spec.label}</label>
              {spec.type === 'textarea' ? (
                <textarea
                  className="input min-h-[88px]"
                  rows={4}
                  maxLength={spec.maxLength}
                  value={value}
                  onChange={(e) => set(spec, e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  type={spec.type === 'number' ? 'number' : 'text'}
                  inputMode={spec.type === 'number' ? 'numeric' : undefined}
                  min={spec.min}
                  max={spec.max}
                  maxLength={spec.maxLength}
                  value={value}
                  onChange={(e) => set(spec, e.target.value)}
                />
              )}
              {spec.help && <p className="mt-1 text-xs text-slate-500">{spec.help}</p>}
            </div>
          )
        })}
        {changed > 0 && (
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => onChange({})}>
            <RotateCcw size={14} /> Reset to the format's defaults
          </button>
        )}
      </div>
    </details>
  )
}

function ScopeEditor({ label, sublabel, formats, value, allowInherit, inheritLabel, onChange }) {
  const selectedId = value?.formatId || (allowInherit ? '' : 'STANDARD')
  const format = formats.find((f) => f.id === selectedId)
  return (
    <div className="min-w-0 rounded-md border border-slate-200 p-3">
      <label className="label">{label}</label>
      {sublabel && <p className="-mt-1 mb-1 text-xs text-slate-500">{sublabel}</p>}
      <select
        className="input"
        value={selectedId}
        disabled={!allowInherit && formats.length < 2}
        onChange={(e) => onChange(e.target.value ? { formatId: e.target.value, options: {} } : null)}
      >
        {allowInherit && <option value="">{inheritLabel}</option>}
        {formats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
      {format?.description && <p className="mt-1 text-xs text-slate-500">{format.description}</p>}
      {format && format.options?.length > 0 && (
        <OptionsEditor
          format={format}
          options={value?.options || {}}
          onChange={(options) => onChange({ formatId: format.id, options })}
        />
      )}
    </div>
  )
}

export default function PrintFormatsDialog({ user, onClose, onSaved }) {
  const [catalog, setCatalog] = useState(null)
  const [presets, setPresets] = useState([])
  const [state, setState] = useState({ VALUATION: {}, SELL_BILL: {} })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([api.printFormats.catalog(), api.printFormats.forUser(user.id)])
      .then(([cat, data]) => {
        if (!alive) return
        setCatalog(cat)
        setPresets(data.bankPresets || [])
        const next = { VALUATION: {}, SELL_BILL: {} }
        for (const row of data.assignments || []) {
          if (!next[row.docType]) continue
          next[row.docType][String(row.bankPresetId)] = { formatId: row.formatId, options: row.options || {} }
        }
        setState(next)
      })
      .catch((error) => {
        toast.error(error.message || 'Could not load print formats.')
        onClose()
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user.id])

  const formatsFor = (docType) => catalog?.formats?.[docType] || []
  const labelOf = (docType, formatId) => shortFormatLabel(formatsFor(docType).find((f) => f.id === formatId))

  const setScope = (docType, scope, value) => {
    setState((current) => {
      const scopes = { ...current[docType] }
      if (value) scopes[scope] = value
      else delete scopes[scope]
      return { ...current, [docType]: scopes }
    })
  }

  const payload = useMemo(() => {
    const list = []
    for (const { docType } of DOC_SECTIONS) {
      const scopes = state[docType] || {}
      list.push({ docType, bankPresetId: 0, formatId: scopes['0']?.formatId || 'STANDARD', options: scopes['0']?.options || {} })
      for (const preset of presets) {
        const value = scopes[String(preset.id)]
        if (value?.formatId) list.push({ docType, bankPresetId: preset.id, formatId: value.formatId, options: value.options || {} })
      }
    }
    return list
  }, [state, presets])

  const save = async () => {
    setSaving(true)
    try {
      await api.printFormats.saveForUser(user.id, payload)
      toast.success(`Print formats saved for ${user.name}.`)
      onSaved?.()
      onClose()
    } catch (error) {
      toast.error(error.message || 'Could not save print formats.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg sm:shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Print formats</h2>
            <p className="truncate text-sm text-slate-500">{user.name} · {user.email}</p>
          </div>
          <button type="button" className="btn-ghost shrink-0 px-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <p className="rounded-md bg-gold-50 p-3 text-xs leading-relaxed text-slate-700">
                Only you (admin) can change these. Drafts use the new layout right away. Reports already
                printed or shared, and sell bills already created, keep the layout they were issued in.
              </p>
              {DOC_SECTIONS.map(({ docType, title }) => {
                const formats = formatsFor(docType)
                const scopes = state[docType] || {}
                const defaultLabel = labelOf(docType, scopes['0']?.formatId || 'STANDARD')
                const hasChoice = formats.length > 1
                return (
                  <section key={docType} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
                    <ScopeEditor
                      label="Default for this user"
                      formats={formats}
                      value={scopes['0']}
                      allowInherit={false}
                      onChange={(value) => setScope(docType, '0', value)}
                    />
                    {!hasChoice && (
                      <p className="text-xs text-slate-500">Only the Standard layout exists for now. New layouts will appear here when they are added.</p>
                    )}
                    {hasChoice && presets.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">
                          Per bank (optional) — used instead of the user default for {docType === 'VALUATION' ? 'reports' : 'bills made from reports'} of that bank.
                        </p>
                        {presets.map((preset) => (
                          <ScopeEditor
                            key={preset.id}
                            label={`${preset.bankName}${preset.branch ? ` — ${preset.branch}` : ''}`}
                            sublabel={preset.branchCode ? `Branch code ${preset.branchCode}` : ''}
                            formats={formats}
                            value={scopes[String(preset.id)]}
                            allowInherit
                            inheritLabel={`Same as user default (${defaultLabel})`}
                            onChange={(value) => setScope(docType, String(preset.id), value)}
                          />
                        ))}
                      </div>
                    )}
                    {hasChoice && presets.length === 0 && (
                      <p className="text-xs text-slate-500">This user has no bank presets yet, so only the user default applies.</p>
                    )}
                  </section>
                )
              })}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving || loading}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
