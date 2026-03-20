/** ── Content Model ─────────────────────────────────────────────────── */

export type ContentType = 'faq' | 'article' | 'guide' | 'snippet' | 'email-template';
export type Audience = 'student' | 'staff' | 'public';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface ContentMeta {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  category: string;
  tags: string[];
  audience: Audience;
  locale: string;
  priority: Priority;
  updatedAt: string;
  visibility: 'published' | 'draft';
  relatedSlugs?: string[];
  suggestedActions?: SuggestedAction[];
  /** Short answer for FAQ cards (plain text) */
  excerpt?: string;
  /** Area/department responsible */
  area?: string;
  /** Contact email for escalation */
  contactEmail?: string;
}

export interface ContentItem extends ContentMeta {
  content: string;       // raw MDX body
  htmlContent?: string;  // rendered HTML
}

export interface SuggestedAction {
  type: 'link' | 'email' | 'ticket' | 'escalate' | 'lead';
  label: string;
  href?: string;
  data?: Record<string, string>;
}

/** ── Chat Contract ────────────────────────────────────────────────── */

export interface ChatRequest {
  message: string;
  mode: 'help' | 'enrollment' | 'support';
  locale: string;
  history?: ChatHistoryItem[];
  context?: Record<string, string>;
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  sources?: ChatSource[];
  metadata: {
    source: 'faq' | 'retrieval' | 'llm' | 'fallback';
    confidence: 'high' | 'medium' | 'low';
    mode: string;
    processingMs: number;
  };
  suggestedActions?: SuggestedAction[];
  escalationHint?: string;
}

export interface ChatSource {
  title: string;
  slug: string;
  type: ContentType;
  category: string;
}

/** ── Search ───────────────────────────────────────────────────────── */

export interface SearchResult {
  item: ContentMeta;
  score: number;
  matches?: string[];
}

/** ── Categories ───────────────────────────────────────────────────── */

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  order: number;
}

/** ── Tickets ──────────────────────────────────────────────────────── */

export type TicketStatus = 'open' | 'in_review' | 'waiting_student' | 'resolved' | 'closed';
export type TicketChannel = 'chat' | 'help' | 'manual' | 'email';

export interface Ticket {
  id: string;
  folio: string;
  studentName: string;
  studentId: string;        // matrícula
  studentEmail: string;
  category: string;
  subcategory?: string;
  priority: Priority;
  subject: string;
  description: string;
  channel: TicketChannel;
  status: TicketStatus;
  assignee?: string;
  department?: string;
  relatedArticles?: string[];  // slugs
  chatContext?: string;        // original chat question
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  messages: TicketMessage[];
  tags?: string[];
  nexusCaseId?: string;       // synced to Nexus
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  author: string;
  authorType: 'student' | 'staff' | 'system';
  content: string;
  createdAt: string;
  attachments?: string[];
}

export interface CreateTicketRequest {
  studentName: string;
  studentId: string;
  studentEmail: string;
  category: string;
  subcategory?: string;
  priority?: Priority;
  subject: string;
  description: string;
  channel: TicketChannel;
  chatContext?: string;
  relatedArticles?: string[];
}

/** ── Analytics ────────────────────────────────────────────────────── */

export interface AnalyticsEvent {
  id?: number;
  type: 'search' | 'chat' | 'article_view' | 'faq_expand' | 'ticket_create' | 'escalation';
  query?: string;
  category?: string;
  slug?: string;
  confidence?: string;
  source?: string;
  resolved?: boolean;
  sessionId?: string;
  createdAt?: string;
}

export interface AnalyticsSummary {
  totalSearches: number;
  totalChats: number;
  totalTickets: number;
  totalArticleViews: number;
  selfServiceRate: number;     // % resolved without ticket
  escalationRate: number;      // % that created a ticket
  topSearches: Array<{ query: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
  unresolvedTopics: Array<{ query: string; count: number }>;
  avgResolutionHours: number;
  ticketsByStatus: Record<TicketStatus, number>;
}
