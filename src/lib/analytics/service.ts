import { getDb } from '@/lib/db/database';
import type { AnalyticsEvent, AnalyticsSummary } from '@/types/content';

/**
 * Track an analytics event.
 */
export function trackEvent(event: AnalyticsEvent): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO analytics_events (type, query, category, slug, confidence, source, resolved, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.type,
      event.query || null,
      event.category || null,
      event.slug || null,
      event.confidence || null,
      event.source || null,
      event.resolved ? 1 : 0,
      event.sessionId || null,
    );
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

/**
 * Get analytics summary for a date range.
 */
export function getSummary(days = 30): AnalyticsSummary {
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const counts = db.prepare(`
    SELECT type, COUNT(*) as count FROM analytics_events
    WHERE created_at >= ? GROUP BY type
  `).all(since) as any[];

  const countMap: Record<string, number> = {};
  for (const r of counts) countMap[r.type] = r.count;

  const totalSearches = countMap['search'] || 0;
  const totalChats = countMap['chat'] || 0;
  const totalTickets = countMap['ticket_create'] || 0;
  const totalArticleViews = countMap['article_view'] || 0;
  const totalEscalations = countMap['escalation'] || 0;

  // Self-service rate: interactions that didn't create a ticket
  const totalInteractions = totalSearches + totalChats;
  const selfServiceRate = totalInteractions > 0
    ? ((totalInteractions - totalTickets) / totalInteractions) * 100
    : 100;

  const escalationRate = totalChats > 0
    ? (totalEscalations / totalChats) * 100
    : 0;

  // Top searches
  const topSearches = db.prepare(`
    SELECT query, COUNT(*) as count FROM analytics_events
    WHERE type = 'search' AND query IS NOT NULL AND created_at >= ?
    GROUP BY query ORDER BY count DESC LIMIT 15
  `).all(since) as any[];

  // Top categories
  const topCategories = db.prepare(`
    SELECT category, COUNT(*) as count FROM analytics_events
    WHERE category IS NOT NULL AND created_at >= ?
    GROUP BY category ORDER BY count DESC LIMIT 10
  `).all(since) as any[];

  // Unresolved: chat queries with low confidence
  const unresolvedTopics = db.prepare(`
    SELECT query, COUNT(*) as count FROM analytics_events
    WHERE type = 'chat' AND confidence = 'low' AND query IS NOT NULL AND created_at >= ?
    GROUP BY query ORDER BY count DESC LIMIT 10
  `).all(since) as any[];

  // Average resolution time (hours)
  const avgRes = db.prepare(`
    SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) as avg_hours
    FROM tickets WHERE resolved_at IS NOT NULL AND created_at >= ?
  `).get(since) as any;

  // Tickets by status
  const ticketStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM tickets GROUP BY status
  `).all() as any[];

  const ticketsByStatus: Record<string, number> = {
    open: 0, in_review: 0, waiting_student: 0, resolved: 0, closed: 0,
  };
  for (const r of ticketStats) ticketsByStatus[r.status] = r.count;

  return {
    totalSearches,
    totalChats,
    totalTickets,
    totalArticleViews,
    selfServiceRate: Math.round(selfServiceRate * 10) / 10,
    escalationRate: Math.round(escalationRate * 10) / 10,
    topSearches,
    topCategories,
    unresolvedTopics,
    avgResolutionHours: Math.round((avgRes?.avg_hours || 0) * 10) / 10,
    ticketsByStatus: ticketsByStatus as any,
  };
}

/**
 * Get recent events with pagination.
 */
export function getRecentEvents(limit = 50, offset = 0): { events: AnalyticsEvent[]; total: number } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as count FROM analytics_events').get() as any).count;
  const events = db.prepare(
    'SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as any[];
  return { events, total };
}
