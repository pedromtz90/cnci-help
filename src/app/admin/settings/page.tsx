'use client';

import { useState, useEffect } from 'react';
import {
  Settings, Shield, Mail, Brain, Link2, Users, Building2,
  Save, Loader2, CheckCircle2, XCircle, Zap, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';

interface TestResult { ok: boolean; message?: string; error?: string }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data) => { setSettings(data); setLoading(false); });
  }, []);

  const update = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    setSaving(false);
    showToast('Configuración guardada correctamente');
  };

  const handleTest = async (service: string) => {
    setTesting((p) => ({ ...p, [service]: true }));
    setTestResults((p) => ({ ...p, [service]: undefined as any }));
    try {
      const res = await fetch('/api/settings/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service }) });
      const result: TestResult = await res.json();
      setTestResults((p) => ({ ...p, [service]: result }));
    } catch {
      setTestResults((p) => ({ ...p, [service]: { ok: false, error: 'Error de red' } }));
    }
    setTesting((p) => ({ ...p, [service]: false }));
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-cnci-blue" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-up flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-cnci-blue font-medium hover:underline mb-2">
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Settings size={24} className="text-cnci-blue" /> Configuración
            </h1>
            <p className="text-slate-500 text-sm mt-1">Integraciones, accesos y conexiones de la plataforma</p>
          </div>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-cnci-blue text-white font-bold text-sm rounded-xl hover:bg-cnci-dark transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar todo
          </button>
        </div>

        <div className="space-y-6">
          {/* ── Microsoft SSO ── */}
          <Section icon={Shield} title="Microsoft Azure AD (SSO)" description="Permite que alumnos y staff inicien sesión con su cuenta @cncivirtual.mx de Office 365" color="blue">
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-blue-50 p-3 rounded-xl leading-relaxed">
                <strong>Pasos para configurar:</strong> Portal Azure → Azure Active Directory → App registrations → New registration → Nombre: "Centro de Ayuda CNCI" → Redirect URI: <code className="bg-white px-1.5 py-0.5 rounded text-cnci-blue font-mono text-[10px]">https://cncifaq.com/api/auth/callback/azure-ad</code>
              </p>
              <Field label="Client ID (Application ID)" value={settings.azure_ad_client_id} onChange={(v) => update('azure_ad_client_id', v)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              <Field label="Client Secret" value={settings.azure_ad_client_secret} onChange={(v) => update('azure_ad_client_secret', v)} placeholder="Pegar secret..." type="password" />
              <Field label="Tenant ID (Directory ID)" value={settings.azure_ad_tenant_id} onChange={(v) => update('azure_ad_tenant_id', v)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              <TestButton service="azure" label="Probar conexión" onTest={handleTest} result={testResults.azure} testing={testing.azure} />
            </div>
          </Section>

          {/* ── Access Control ── */}
          <Section icon={Users} title="Control de Accesos" description="Define quién es staff y quién es directora por su email" color="violet">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Emails de Staff (separados por coma)</label>
                <textarea
                  value={settings.staff_emails || ''}
                  onChange={(e) => update('staff_emails', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 min-h-[80px] resize-y font-mono text-xs"
                  placeholder="admin@cncivirtual.mx, soporte@cncivirtual.mx, ..."
                />
                <p className="text-[10px] text-slate-400 mt-1">Estos correos pueden gestionar contenido en /admin/content</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Emails de Directora (separados por coma)</label>
                <textarea
                  value={settings.director_emails || ''}
                  onChange={(e) => update('director_emails', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 min-h-[60px] resize-y font-mono text-xs"
                  placeholder="brenda@cncivirtual.mx, ..."
                />
                <p className="text-[10px] text-slate-400 mt-1">Estos correos ven el dashboard de analytics + todo lo de staff</p>
              </div>
            </div>
          </Section>

          {/* ── SMTP ── */}
          <Section icon={Mail} title="Correo Electrónico (SMTP)" description="Para enviar emails automáticos: tickets, encuestas, notificaciones" color="green">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Host SMTP" value={settings.smtp_host} onChange={(v) => update('smtp_host', v)} placeholder="smtp.office365.com" />
                <Field label="Puerto" value={settings.smtp_port} onChange={(v) => update('smtp_port', v)} placeholder="587" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Usuario" value={settings.smtp_user} onChange={(v) => update('smtp_user', v)} placeholder="soporte@cncivirtual.mx" />
                <Field label="Contraseña" value={settings.smtp_pass} onChange={(v) => update('smtp_pass', v)} placeholder="••••" type="password" />
              </div>
              <Field label="Email remitente" value={settings.smtp_from} onChange={(v) => update('smtp_from', v)} placeholder="soporte@cncivirtual.mx" />
              <TestButton service="smtp" label="Probar conexión SMTP" onTest={handleTest} result={testResults.smtp} testing={testing.smtp} />
            </div>
          </Section>

          {/* ── AI ── */}
          <Section icon={Brain} title="Inteligencia Artificial (Chatbot)" description="API key para que el chatbot pueda sintetizar respuestas con IA cuando no encuentra exacta" color="purple">
            <div className="space-y-4">
              <Field label="API Key (Anthropic/Claude)" value={settings.ai_api_key} onChange={(v) => update('ai_api_key', v)} placeholder="sk-ant-..." type="password" />
              <Field label="Modelo" value={settings.ai_model} onChange={(v) => update('ai_model', v)} placeholder="claude-haiku-4-5-20251001" />
              <p className="text-xs text-slate-400">Sin API key, el chatbot funciona solo con la base de conocimientos (búsqueda). Con API key, puede sintetizar respuestas más inteligentes.</p>
              <TestButton service="ai" label="Probar IA" onTest={handleTest} result={testResults.ai} testing={testing.ai} />
            </div>
          </Section>

          {/* ── Nexus ── */}
          <Section icon={Link2} title="Integración con Nexus" description="Sincroniza tickets de CNCI con Nexus CRM para seguimiento interno" color="amber">
            <div className="space-y-4">
              <Field label="URL de Nexus API" value={settings.nexus_api_url} onChange={(v) => update('nexus_api_url', v)} placeholder="https://nexus.phs.mx" />
              <Field label="API Key de Nexus" value={settings.nexus_api_key} onChange={(v) => update('nexus_api_key', v)} placeholder="Bearer token..." type="password" />
              <TestButton service="nexus" label="Probar conexión a Nexus" onTest={handleTest} result={testResults.nexus} testing={testing.nexus} />
            </div>
          </Section>

          {/* ── Chatbot Prompt ── */}
          <Section icon={Brain} title="Personalidad del Chatbot" description="El prompt define cómo responde el chatbot — su tono, reglas y personalidad" color="purple">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">System Prompt</label>
                <textarea
                  value={settings.chatbot_prompt || ''}
                  onChange={(e) => update('chatbot_prompt', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 min-h-[250px] resize-y font-mono text-xs leading-relaxed"
                  placeholder="Eres un Ejecutivo de Servicios Estudiantiles..."
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Este texto le dice al chatbot quién es, cómo debe responder y qué reglas seguir.
                  Se usa cuando el chatbot necesita generar respuestas con IA.
                  Puedes editarlo para cambiar el tono, agregar reglas o ajustar el comportamiento.
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-xl">
                <p className="text-xs text-purple-700 font-medium mb-2">Tips para un buen prompt:</p>
                <ul className="text-[11px] text-purple-600 space-y-1 list-disc pl-4">
                  <li>Define quién es el chatbot (ej. "Eres un ejecutivo de servicios estudiantiles")</li>
                  <li>Indica el tono (profesional, amable, cercano)</li>
                  <li>Pon reglas claras (no inventar info, citar fuentes, sugerir tickets)</li>
                  <li>Indica que responda paso a paso cuando sea necesario</li>
                  <li>Pide que sugiera escalación si no puede resolver</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* ── Branding ── */}
          <Section icon={Building2} title="Datos de la Institución" description="Nombre y teléfono que aparecen en la plataforma" color="slate">
            <div className="space-y-4">
              <Field label="Nombre de la institución" value={settings.institution_name} onChange={(v) => update('institution_name', v)} placeholder="Universidad Virtual CNCI" />
              <Field label="Teléfono de soporte" value={settings.support_phone} onChange={(v) => update('support_phone', v)} placeholder="800 681 5314" />
            </div>
          </Section>
        </div>

        {/* Save bar */}
        <div className="sticky bottom-4 mt-8">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">Los cambios se aplican al guardar. El SSO requiere reinicio del servidor.</p>
            <button onClick={handleSave} disabled={saving} className="px-8 py-3 bg-cnci-blue text-white font-bold text-sm rounded-xl hover:bg-cnci-dark transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar configuración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Section({ icon: Icon, title, description, color, children }: { icon: any; title: string; description: string; color: string; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50/30',
    violet: 'border-violet-200 bg-violet-50/30',
    green: 'border-green-200 bg-green-50/30',
    purple: 'border-purple-200 bg-purple-50/30',
    amber: 'border-amber-200 bg-amber-50/30',
    slate: 'border-slate-200 bg-slate-50/30',
  };
  const iconColor: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-100',
    violet: 'text-violet-600 bg-violet-100',
    green: 'text-green-600 bg-green-100',
    purple: 'text-purple-600 bg-purple-100',
    amber: 'text-amber-600 bg-amber-100',
    slate: 'text-slate-600 bg-slate-100',
  };

  return (
    <div className={`rounded-2xl border p-6 ${colorMap[color] || colorMap.slate}`}>
      <div className="flex items-start gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor[color] || iconColor.slate}`}>
          <Icon size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value?: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cnci-blue/20 focus:border-cnci-blue transition-all font-mono text-xs"
      />
    </div>
  );
}

function TestButton({ service, label, onTest, result, testing }: { service: string; label: string; onTest: (s: string) => void; result?: TestResult; testing?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onTest(service)}
        disabled={testing}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:text-cnci-blue hover:border-cnci-blue/30 transition-all disabled:opacity-50"
      >
        {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        {label}
      </button>
      {result && (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
          {result.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {result.ok ? result.message : result.error}
        </div>
      )}
    </div>
  );
}
