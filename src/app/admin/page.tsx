'use client';

import { useState, useEffect } from 'react';
import {
  Search, MessageCircle, Ticket, Eye, TrendingUp, TrendingDown,
  Clock, AlertTriangle, CheckCircle2, BarChart3, Users, Loader2, RefreshCw,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import type { AnalyticsSummary, TicketStatus } from '@/types/content';

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Abiertos',
  in_review: 'En revisión',
  waiting_student: 'Esperando alumno',
  resolved: 'Resueltos',
  closed: 'Cerrados',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'text-blue-600 bg-blue-50',
  in_review: 'text-amber-600 bg-amber-50',
  waiting_student: 'text-purple-600 bg-purple-50',
  resolved: 'text-green-600 bg-green-50',
  closed: 'text-slate-500 bg-slate-100',
};

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?view=summary&days=${days}`);
      setData(await res.json());
    } catch {
      console.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [days]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard de Servicio Estudiantil</h1>
            <p className="text-slate-500 font-medium mt-1">Métricas de adopción y uso del Centro de Ayuda</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cnci-blue/30"
            >
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
            </select>
            <button onClick={loadData} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-cnci-blue hover:border-cnci-blue/30 transition-colors">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-cnci-blue" />
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KPICard icon={Search} label="Búsquedas" value={data.totalSearches} color="text-blue-600" bg="bg-blue-50" />
              <KPICard icon={MessageCircle} label="Chats" value={data.totalChats} color="text-purple-600" bg="bg-purple-50" />
              <KPICard icon={Ticket} label="Tickets creados" value={data.totalTickets} color="text-amber-600" bg="bg-amber-50" />
              <KPICard icon={Eye} label="Artículos vistos" value={data.totalArticleViews} color="text-green-600" bg="bg-green-50" />
            </div>

            {/* Rates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <RateCard
                icon={CheckCircle2}
                label="Resolución self-service"
                value={data.selfServiceRate}
                suffix="%"
                description="Dudas resueltas sin ticket"
                positive={data.selfServiceRate > 70}
              />
              <RateCard
                icon={AlertTriangle}
                label="Tasa de escalación"
                value={data.escalationRate}
                suffix="%"
                description="Chats que crearon ticket"
                positive={data.escalationRate < 20}
              />
              <RateCard
                icon={Clock}
                label="Tiempo medio resolución"
                value={data.avgResolutionHours}
                suffix=" hrs"
                description="Desde creación hasta resolución"
                positive={data.avgResolutionHours < 48}
              />
            </div>

            {/* Tickets by status */}
            <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-6 mb-8">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-cnci-blue" /> Estado de Tickets
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((status) => (
                  <div key={status} className={`rounded-2xl p-4 text-center ${STATUS_COLORS[status]}`}>
                    <div className="text-2xl font-black">{data.ticketsByStatus[status] || 0}</div>
                    <div className="text-xs font-bold mt-1">{STATUS_LABELS[status]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ListCard title="Top Búsquedas" icon={Search} items={data.topSearches.map((s) => ({ label: s.query, value: s.count }))} />
              <ListCard title="Top Categorías" icon={Users} items={data.topCategories.map((s) => ({ label: s.category, value: s.count }))} />
              <ListCard title="Temas sin resolver" icon={AlertTriangle} items={data.unresolvedTopics.map((s) => ({ label: s.query, value: s.count }))} emptyText="Sin temas pendientes" highlight />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-6">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon size={20} className={color} />
      </div>
      <div className="text-3xl font-black text-slate-800">{value.toLocaleString()}</div>
      <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function RateCard({ icon: Icon, label, value, suffix, description, positive }: { icon: any; label: string; value: number; suffix: string; description: string; positive: boolean }) {
  return (
    <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <Icon size={18} className={positive ? 'text-green-500' : 'text-amber-500'} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-slate-800">{value}</span>
        <span className="text-sm font-bold text-slate-400">{suffix}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {positive ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-amber-500" />}
        <span className="text-xs text-slate-500">{description}</span>
      </div>
    </div>
  );
}

function ListCard({ title, icon: Icon, items, emptyText, highlight }: { title: string; icon: any; items: Array<{ label: string; value: number }>; emptyText?: string; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-6">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Icon size={16} className="text-cnci-blue" /> {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm italic py-4">{emptyText || 'Sin datos'}</p>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 8).map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className={`text-sm truncate max-w-[200px] ${highlight ? 'text-amber-700 font-medium' : 'text-slate-600'}`}>
                {item.label}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${highlight ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
