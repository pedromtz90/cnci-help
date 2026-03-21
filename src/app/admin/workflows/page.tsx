'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, ArrowRight, Zap, GitBranch, Plus, Pencil, Trash2, Save, X, HelpCircle, ArrowLeft, Power } from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';

interface Step { id: string; action: string; label: string; description: string; condition?: string; }
interface Workflow { id: string; name: string; description: string; trigger_description: string; trigger_keywords: string; enabled: boolean; steps: Step[]; }

const ACTIONS = [
  { value: 'record-gap', label: 'Registrar pregunta sin respuesta', help: 'Guarda la pregunta para entrenar al chatbot' },
  { value: 'create-ticket', label: 'Crear ticket automático', help: 'Crea un ticket para seguimiento de soporte' },
  { value: 'escalate-nexus', label: 'Escalar a asesor (Nexus)', help: 'Envía la conversación a Nexus para atención humana' },
  { value: 'track-event', label: 'Registrar en métricas', help: 'Registra en analytics para estadísticas' },
  { value: 'check-threshold', label: 'Verificar condición', help: 'Verifica una condición antes de continuar' },
  { value: 'send-email', label: 'Enviar correo', help: 'Envía un correo automático' },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/workflows'); const d = await r.json(); setWorkflows(d.workflows || []); } catch {} setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const handleSave = async () => { if (!editing) return; setSaving(true); try { const r = await fetch('/api/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) }); const d = await r.json(); if (r.ok) { showToast('Flujo guardado'); setEditing(null); setIsNew(false); load(); } else { showToast(d.error || 'Error'); } } catch { showToast('Error de conexión'); } setSaving(false); };
  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar este flujo?')) return; await fetch('/api/workflows', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); showToast('Eliminado'); load(); };
  const handleTest = async (wf: Workflow) => { setTestingId(wf.id); setTestResult(null); try { const r = await fetch('/api/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run', workflow: wf.id, data: { question: 'Prueba', studentName: 'Test', studentEmail: 'test@cnci.mx', category: 'soporte', failureCount: 3 } }) }); setTestResult(await r.json()); } catch {} setTestingId(null); };
  const handleToggle = async (wf: Workflow) => { await fetch('/api/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...wf, enabled: !wf.enabled }) }); showToast(wf.enabled ? 'Desactivado' : 'Activado'); load(); };
  const startNew = () => { setEditing({ id: '', name: '', description: '', trigger_description: '', trigger_keywords: '', enabled: true, steps: [{ id: 'step-1', action: 'track-event', label: '', description: '' }] }); setIsNew(true); };
  const inp = "w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      {toast && <div className="fixed top-4 right-4 z-[100] bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-up flex items-center gap-2"><CheckCircle2 size={16} />{toast}</div>}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline mb-2"><ArrowLeft size={14} /> Dashboard</Link>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2"><GitBranch size={24} className="text-blue-600" /> Flujos Automáticos</h1>
            <p className="text-slate-500 text-sm mt-1">Crea y edita los flujos que se ejecutan cuando el chatbot detecta ciertas situaciones.</p>
          </div>
          <button onClick={startNew} className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 shadow-md flex items-center gap-2"><Plus size={16} /> Nuevo flujo</button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <HelpCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800 font-medium mb-1">¿Cómo funcionan los flujos?</p>
              <p className="text-xs text-blue-600 leading-relaxed">Cada flujo tiene un disparador (por ejemplo, "el chatbot no sabe la respuesta") y una serie de pasos que se ejecutan automáticamente (registrar la pregunta, crear un ticket, avisar a un asesor). Puedes crear los que necesites, activarlos o desactivarlos, y probarlos antes de ponerlos en producción.</p>
            </div>
          </div>
        </div>

        {/* Editor */}
        {editing && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => { setEditing(null); setIsNew(false); }}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-extrabold text-slate-800">{isNew ? 'Crear nuevo flujo' : 'Editar flujo'}</h2>
                <button onClick={() => { setEditing(null); setIsNew(false); }} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                {isNew && <div><label className="block text-xs font-bold text-slate-500 mb-1">ID (sin espacios, solo minúsculas y guiones)</label><input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className={inp} placeholder="mi-flujo" /></div>}
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Nombre</label><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} placeholder="Ej: Alumno frustrado → Escalar" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Descripción (explica para qué sirve este flujo)</label><textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={`${inp} min-h-[80px] resize-y`} placeholder="Cuando el chatbot no puede resolver la pregunta del alumno, este flujo se encarga de..." /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">¿Cuándo se activa?</label><input value={editing.trigger_description} onChange={(e) => setEditing({ ...editing, trigger_description: e.target.value })} className={inp} placeholder="Ej: Cuando el chatbot no puede responder" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Palabras clave (separadas por coma, opcional)</label><input value={editing.trigger_keywords} onChange={(e) => setEditing({ ...editing, trigger_keywords: e.target.value })} className={inp} placeholder="Ej: pago, beca, factura" /><p className="text-[10px] text-slate-400 mt-1">Si el mensaje del alumno contiene alguna de estas palabras, se activa el flujo.</p></div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-slate-500">Pasos del flujo</label>
                    <button onClick={() => setEditing({ ...editing, steps: [...editing.steps, { id: `step-${editing.steps.length + 1}`, action: 'track-event', label: '', description: '' }] })} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Agregar paso</button>
                  </div>
                  {editing.steps.map((step, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-xs font-bold text-slate-600">Paso {i + 1}</span>
                        {editing.steps.length > 1 && <button onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, j) => j !== i) })} className="ml-auto text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
                      </div>
                      <div className="space-y-2">
                        <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Acción</label><select value={step.action} onChange={(e) => { const s = [...editing.steps]; s[i] = { ...s[i], action: e.target.value }; setEditing({ ...editing, steps: s }); }} className={inp}>{ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select><p className="text-[10px] text-slate-400 mt-0.5">{ACTIONS.find((a) => a.value === step.action)?.help}</p></div>
                        <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Nombre del paso</label><input value={step.label} onChange={(e) => { const s = [...editing.steps]; s[i] = { ...s[i], label: e.target.value }; setEditing({ ...editing, steps: s }); }} className={inp} placeholder="Ej: Crear ticket urgente" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Descripción</label><input value={step.description} onChange={(e) => { const s = [...editing.steps]; s[i] = { ...s[i], description: e.target.value }; setEditing({ ...editing, steps: s }); }} className={inp} placeholder="Explica qué hace este paso" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Condición (opcional)</label><input value={step.condition || ''} onChange={(e) => { const s = [...editing.steps]; s[i] = { ...s[i], condition: e.target.value }; setEditing({ ...editing, steps: s }); }} className={inp} placeholder="Ej: Solo si tenemos el correo del alumno" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => { setEditing(null); setIsNew(false); }} className="px-5 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-blue-600" /></div> : workflows.length === 0 ? (
          <div className="bg-white rounded-3xl border p-12 text-center">
            <GitBranch size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">No hay flujos todavía</h3>
            <p className="text-slate-500 mb-4">Crea tu primer flujo automático.</p>
            <button onClick={startNew} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md">Crear flujo</button>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((wf) => (
              <div key={wf.id} className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${wf.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><h3 className="font-bold text-slate-800">{wf.name}</h3><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${wf.enabled ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{wf.enabled ? 'Activo' : 'Inactivo'}</span></div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{wf.description}</p>
                    <div className="flex items-center gap-2 mt-2"><Zap size={11} className="text-slate-400" /><span className="text-[10px] text-slate-400">{wf.trigger_description}</span></div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button onClick={() => handleToggle(wf)} className={`p-2 rounded-lg ${wf.enabled ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-50'}`} title={wf.enabled ? 'Desactivar' : 'Activar'}><Power size={15} /></button>
                    <button onClick={() => { setEditing({ ...wf }); setIsNew(false); }} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Editar"><Pencil size={15} /></button>
                    <button onClick={() => handleTest(wf)} disabled={testingId === wf.id} className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50" title="Probar">{testingId === wf.id ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}</button>
                    <button onClick={() => handleDelete(wf.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50" title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                  <div className="flex items-start gap-1 overflow-x-auto no-scrollbar">
                    {wf.steps.map((step, i) => (
                      <div key={step.id} className="flex items-start shrink-0">
                        <div className="flex flex-col items-center w-[130px]">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 text-xs font-bold">{i + 1}</div>
                          <p className="text-[11px] font-bold text-slate-700 mt-1.5 text-center leading-tight">{step.label}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 text-center leading-snug">{step.description.slice(0, 50)}</p>
                          {step.condition && <span className="text-[8px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded mt-1">{step.condition.slice(0, 25)}</span>}
                        </div>
                        {i < wf.steps.length - 1 && <div className="flex items-center mt-3 px-1"><div className="w-4 h-px bg-slate-300" /><ArrowRight size={10} className="text-slate-300" /></div>}
                      </div>
                    ))}
                  </div>
                </div>
                {testResult && testResult.workflow === wf.id && (
                  <div className={`px-6 py-3 border-t text-xs ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    {testResult.steps?.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        {String(s.result).includes('error') ? <XCircle size={12} className="text-red-400" /> : <CheckCircle2 size={12} className="text-green-400" />}
                        <span className="font-mono text-slate-600">{s.step}</span><span className="text-slate-400">→</span><span className="text-slate-500 truncate">{JSON.stringify(s.result).slice(0, 50)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
