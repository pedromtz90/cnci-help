'use client';

import { useState } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, ArrowRight, Zap, GitBranch, AlertTriangle, Mail, Ticket, UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';

// ── Workflow definitions (visual representation) ────────────────────

interface WorkflowStep {
  id: string;
  label: string;
  icon: any;
  color: string;
  description: string;
  condition?: string;
}

interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  trigger: string;
  color: string;
  steps: WorkflowStep[];
}

const WORKFLOWS: WorkflowDef[] = [
  {
    id: 'no-answer',
    name: 'Sin Respuesta → Escalar',
    description: 'Cuando el chatbot no puede resolver la pregunta del alumno',
    trigger: 'Chatbot responde con fallback (confidence: low)',
    color: 'orange',
    steps: [
      { id: 'record-gap', label: 'Registrar brecha', icon: AlertTriangle, color: 'amber', description: 'Guarda la pregunta sin respuesta para entrenar al chatbot después' },
      { id: 'create-ticket', label: 'Crear ticket', icon: Ticket, color: 'blue', description: 'Crea un ticket automático con la pregunta y el contexto del chat', condition: 'Si tiene email del alumno' },
      { id: 'escalate-nexus', label: 'Escalar a Nexus', icon: ArrowRight, color: 'violet', description: 'Crea conversación en Nexus con todo el historial del chat', condition: 'Si tiene email del alumno' },
    ],
  },
  {
    id: 'payment',
    name: 'Intención de Pago',
    description: 'Cuando el alumno pregunta sobre pagos, costos o becas',
    trigger: 'Mensaje contiene: pago, beca, factura, costo, mensualidad',
    color: 'green',
    steps: [
      { id: 'track-intent', label: 'Registrar intención', icon: Zap, color: 'green', description: 'Registra en analytics que hubo una consulta de pagos' },
    ],
  },
  {
    id: 'enrollment',
    name: 'Intención de Inscripción',
    description: 'Cuando el alumno muestra interés en inscribirse',
    trigger: 'Mensaje contiene: inscribir, estudiar, registro, nuevo ingreso',
    color: 'blue',
    steps: [
      { id: 'track-intent', label: 'Registrar interés', icon: Zap, color: 'blue', description: 'Registra en analytics la intención de inscripción' },
      { id: 'create-lead', label: 'Crear lead en Nexus', icon: UserPlus, color: 'violet', description: 'Crea contacto en Nexus como lead de inscripción', condition: 'Si tiene datos del alumno' },
    ],
  },
  {
    id: 'repeated-failure',
    name: 'Fallas Repetidas → Auto-Escalar',
    description: 'Cuando el chatbot falla 2+ veces seguidas con el mismo alumno',
    trigger: 'failureCount >= 2',
    color: 'red',
    steps: [
      { id: 'check-threshold', label: 'Verificar umbral', icon: GitBranch, color: 'slate', description: 'Verifica si ya van 2+ fallas consecutivas' },
      { id: 'create-ticket', label: 'Ticket prioritario', icon: Ticket, color: 'red', description: 'Crea ticket con prioridad ALTA automáticamente', condition: 'Si umbral superado' },
      { id: 'escalate-nexus', label: 'Escalar urgente', icon: ArrowRight, color: 'red', description: 'Crea conversación urgente en Nexus inbox', condition: 'Si umbral superado' },
    ],
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-400' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-400' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-400' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-400' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-400' },
};

export default function WorkflowsPage() {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const testWorkflow = async (wf: WorkflowDef) => {
    setTestingId(wf.id);
    setTestResult(null);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: wf.id,
          data: {
            question: 'Pregunta de prueba del workflow',
            studentName: 'Test Alumno',
            studentEmail: 'test@cncivirtual.mx',
            category: 'soporte',
            failureCount: wf.id === 'repeated-failure' ? 3 : 0,
          },
        }),
      });
      const data = await res.json();
      setTestResult(data);
      showToast(data.success ? `Workflow "${wf.name}" ejecutado correctamente` : 'Error en workflow');
    } catch {
      showToast('Error de conexión');
    }
    setTestingId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-up flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline mb-2">
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              <GitBranch size={24} className="text-blue-600" /> Workflows
            </h1>
            <p className="text-slate-500 text-sm mt-1">Flujos automáticos que se disparan según el comportamiento del chatbot</p>
          </div>
        </div>

        <div className="space-y-6">
          {WORKFLOWS.map((wf) => {
            const wfColor = COLOR_MAP[wf.color] || COLOR_MAP.slate;
            return (
              <div key={wf.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {/* Header */}
                <div className={`px-6 py-4 ${wfColor.bg} border-b ${wfColor.border}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className={`font-bold text-base ${wfColor.text}`}>{wf.name}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{wf.description}</p>
                    </div>
                    <button
                      onClick={() => testWorkflow(wf)}
                      disabled={testingId === wf.id}
                      className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${wfColor.dot.replace('bg-', 'bg-')} hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all`}
                      style={{ backgroundColor: wfColor.dot === 'bg-amber-400' ? '#f59e0b' : wfColor.dot === 'bg-blue-400' ? '#60a5fa' : wfColor.dot === 'bg-green-400' ? '#4ade80' : wfColor.dot === 'bg-red-400' ? '#f87171' : '#94a3b8' }}
                    >
                      {testingId === wf.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                      Probar
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Zap size={11} className="text-slate-400" />
                    <span className="text-[10px] font-mono text-slate-400">{wf.trigger}</span>
                  </div>
                </div>

                {/* Steps — visual flow */}
                <div className="px-6 py-5">
                  <div className="flex items-start gap-0">
                    {wf.steps.map((step, i) => {
                      const stepColor = COLOR_MAP[step.color] || COLOR_MAP.slate;
                      return (
                        <div key={step.id} className="flex items-start">
                          {/* Step node */}
                          <div className="flex flex-col items-center min-w-[140px]">
                            <div className={`w-10 h-10 rounded-xl ${stepColor.bg} border ${stepColor.border} flex items-center justify-center`}>
                              <step.icon size={18} className={stepColor.text} />
                            </div>
                            <p className="text-xs font-bold text-slate-700 mt-2 text-center">{step.label}</p>
                            <p className="text-[10px] text-slate-400 mt-1 text-center max-w-[130px] leading-snug">{step.description}</p>
                            {step.condition && (
                              <span className="text-[9px] font-mono text-amber-500 mt-1.5 bg-amber-50 px-2 py-0.5 rounded">
                                {step.condition}
                              </span>
                            )}
                          </div>

                          {/* Arrow connector */}
                          {i < wf.steps.length - 1 && (
                            <div className="flex items-center mt-4 px-2">
                              <div className="w-8 h-px bg-slate-300" />
                              <ArrowRight size={12} className="text-slate-300 -ml-1" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Test result */}
                {testResult && testResult.workflow === wf.id && (
                  <div className={`px-6 py-4 border-t ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {testResult.success ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                      <span className={`text-xs font-bold ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        {testResult.success ? 'Ejecutado correctamente' : 'Error en ejecución'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {testResult.steps?.map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className={`w-4 h-4 rounded flex items-center justify-center ${typeof s.result === 'string' && s.result.startsWith('error') ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
                            {typeof s.result === 'string' && s.result.startsWith('error') ? '✗' : '✓'}
                          </span>
                          <span className="font-mono text-slate-600">{s.step}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-slate-500 truncate max-w-[300px]">{JSON.stringify(s.result)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
