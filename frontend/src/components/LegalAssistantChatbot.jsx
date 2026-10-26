import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scale,
  Bot,
  Send,
  Sparkles,
  History,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  HelpCircle,
  X,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers,
  Calendar,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/LegalAssistantChatbot.css';

/**
 * Format markdown text into styled React elements
 * (Headers, bold, italics, bullet points, numbered lists, blockquotes)
 */
function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let currentList = [];
  let listType = null; // 'ul' | 'ol'

  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
            {currentList.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
            {currentList.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>{renderInline(item)}</li>
            ))}
          </ul>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  const renderInline = (text) => {
    // Replace **bold** with <strong>
    const parts = [];
    let remaining = text;
    let keyIdx = 0;

    // Pattern for bold: **text**
    const regex = /\*\*(.*?)\*\*/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(<strong key={`b-${keyIdx++}`} style={{ color: '#172B4D' }}>{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${index}`} style={{ fontSize: '1rem', fontWeight: 700, color: '#172B4D', margin: '0.85rem 0 0.35rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.25rem' }}>
          {renderInline(trimmed.substring(4))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index}`} style={{ fontSize: '1.125rem', fontWeight: 700, color: '#172B4D', margin: '1rem 0 0.4rem' }}>
          {renderInline(trimmed.substring(3))}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${index}`} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#172B4D', margin: '1rem 0 0.5rem' }}>
          {renderInline(trimmed.substring(2))}
        </h2>
      );
    }
    // Blockquote
    else if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`bq-${index}`} style={{ margin: '0.5rem 0', padding: '0.5rem 0.85rem', background: '#F8FAFC', borderLeft: '3px solid #B99A5B', fontStyle: 'italic', color: '#475569', borderRadius: '0 6px 6px 0' }}>
          {renderInline(trimmed.substring(2))}
        </blockquote>
      );
    }
    // Bullet list item (- or *)
    else if (/^[-*]\s+/.test(trimmed)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      currentList.push(trimmed.replace(/^[-*]\s+/, ''));
    }
    // Numbered list item
    else if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      currentList.push(trimmed.replace(/^\d+\.\s+/, ''));
    }
    // Horizontal divider
    else if (trimmed === '---') {
      flushList();
      elements.push(<hr key={`hr-${index}`} style={{ border: 'none', borderTop: '1px dashed #CBD5E1', margin: '0.75rem 0' }} />);
    }
    // Standard Paragraph
    else {
      flushList();
      elements.push(
        <p key={`p-${index}`} style={{ margin: '0.35rem 0', lineHeight: 1.6 }}>
          {renderInline(trimmed)}
        </p>
      );
    }
  });

  flushList();
  return <div className="markdown-content">{elements}</div>;
}

export default function LegalAssistantChatbot({ isModal = false, onClose = null, initialCaseId = null }) {
  const { user, csrfToken } = useAuth();

  // Context Selectors
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId || '');
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [perspective, setPerspective] = useState('comprehensive'); // 'comprehensive' | 'strategic'

  // Sessions & History
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Chat Stream & Messages
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [expandedCitations, setExpandedCitations] = useState({});

  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Load user's authorized cases
  const fetchCases = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/cases', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
        if (!selectedCaseId && data.cases && data.cases.length > 0) {
          setSelectedCaseId(data.cases[0].case_id);
        }
      }
    } catch (err) {
      console.error('Failed to load chat cases:', err);
    }
  }, [selectedCaseId]);

  // Load documents for selected case
  const fetchDocuments = useCallback(async (caseId) => {
    if (!caseId) {
      setDocuments([]);
      setSelectedDocId('');
      return;
    }
    try {
      const res = await fetch(`/api/chat/cases/${caseId}/documents`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load case documents:', err);
    }
  }, []);

  // Load suggested prompt chips
  const fetchPrompts = useCallback(async (caseId) => {
    try {
      const url = caseId ? `/api/chat/suggested-prompts?case_id=${caseId}` : '/api/chat/suggested-prompts';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSuggestedPrompts(data.prompts || []);
      }
    } catch (err) {
      console.error('Failed to load suggested prompts:', err);
    }
  }, []);

  // Load user sessions
  const fetchSessions = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/chat/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load specific session messages
  const loadSession = useCallback(async (sessionId) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(sessionId);
        setMessages(data.messages || []);
        if (data.session) {
          if (data.session.case_id) setSelectedCaseId(data.session.case_id);
          if (data.session.document_id) setSelectedDocId(data.session.document_id);
          if (data.session.perspective) setPerspective(data.session.perspective);
        }
      }
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCases();
    fetchSessions();
    fetchPrompts(selectedCaseId);
  }, [fetchCases, fetchSessions, fetchPrompts, selectedCaseId]);

  // When selectedCaseId changes, load its documents
  useEffect(() => {
    if (selectedCaseId) {
      fetchDocuments(selectedCaseId);
      fetchPrompts(selectedCaseId);
    }
  }, [selectedCaseId, fetchDocuments, fetchPrompts]);

  // Handle New Consultation
  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInputQuery('');
    setExpandedCitations({});
  };

  // Delete Session
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this chat consultation?')) return;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken },
        credentials: 'include'
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
        if (currentSessionId === sessionId) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete chat session:', err);
    }
  };

  // Submit Query
  const handleSendQuery = async (queryToSend = null) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || sending) return;

    // Append user message immediately to UI
    const tempUserMsg = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInputQuery('');
    setSending(true);

    try {
      const payload = {
        query: text,
        session_id: currentSessionId,
        case_id: selectedCaseId ? parseInt(selectedCaseId, 10) : null,
        document_id: selectedDocId ? parseInt(selectedDocId, 10) : null,
        perspective: perspective
      };

      const res = await fetch('/api/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session_id && currentSessionId !== data.session_id) {
          setCurrentSessionId(data.session_id);
          fetchSessions();
        }

        const assistantMsg = {
          role: 'assistant',
          content: data.answer,
          citations: data.citations || [],
          model: data.model,
          created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errData = await res.json().catch(() => ({}));
        const errorMsg = {
          role: 'assistant',
          content: `⚠️ **Unable to complete inquiry**: ${errData.error || 'Server error occurred while retrieving case intelligence.'}\n\n*Please verify case permissions and try again.*`,
          citations: [],
          created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: `⚠️ **Network Connection Failed**: Unable to reach AI intelligence service (${err.message}).`,
        citations: [],
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  // Copy to clipboard
  const handleCopy = (content, index) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Toggle citations accordion
  const toggleCitations = (index) => {
    setExpandedCitations((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const chatbotInner = (
    <div className="legal-chatbot-container">
      {/* 1. Header */}
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <div className="chatbot-icon-badge">
            <Scale size={24} />
          </div>
          <div>
            <h3 className="chatbot-header-title">
              Legal CaseBook AI Assistant
              <span className="chatbot-model-tag">Verified Legal Intelligence</span>
            </h3>
            <div className="chatbot-header-subtitle">
              <Sparkles size={13} /> Case Intelligence & Strategic Legal Counsel
            </div>
          </div>
        </div>

        <div className="chatbot-header-actions">
          <button
            type="button"
            className="chatbot-action-btn"
            onClick={() => setShowHistory(!showHistory)}
            title="Toggle Consultation History"
          >
            <History size={15} />
            <span>{showHistory ? 'Hide History' : 'History'}</span>
          </button>

          <button
            type="button"
            className="chatbot-action-btn"
            onClick={handleNewChat}
            title="Start New Consultation"
          >
            <Plus size={15} />
            <span>New Chat</span>
          </button>

          {isModal && onClose && (
            <button
              type="button"
              className="chatbot-close-btn"
              onClick={onClose}
              title="Close Assistant"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Controls & Context Selector Bar */}
      <div className="chatbot-context-bar">
        <div className="chatbot-context-selects">
          <div className="chatbot-select-group">
            <Briefcase size={15} />
            <select
              className="chatbot-select-input"
              value={selectedCaseId}
              onChange={(e) => {
                setSelectedCaseId(e.target.value);
                setSelectedDocId('');
              }}
            >
              <option value="">All Accessible Cases</option>
              {cases.map((c) => (
                <option key={c.case_id} value={c.case_id}>
                  {c.case_number}: {c.title.length > 38 ? `${c.title.substring(0, 38)}...` : c.title}
                </option>
              ))}
            </select>
          </div>

          {documents.length > 0 && (
            <div className="chatbot-select-group">
              <FileText size={15} />
              <select
                className="chatbot-select-input"
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
              >
                <option value="">All Case Documents ({documents.length})</option>
                {documents.map((d) => (
                  <option key={d.document_id} value={d.document_id}>
                    {d.file_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Perspective Switcher */}
        <div className="chatbot-perspective-toggle">
          <button
            type="button"
            className={`chatbot-perspective-btn ${perspective === 'comprehensive' ? 'active' : ''}`}
            onClick={() => setPerspective('comprehensive')}
            title="Meticulous objective extraction and document citations"
          >
            Comprehensive Analysis
          </button>
          <button
            type="button"
            className={`chatbot-perspective-btn strategic ${perspective === 'strategic' ? 'active' : ''}`}
            onClick={() => setPerspective('strategic')}
            title="Litigation vulnerabilities, risk scrutiny, and tactical advocate questions"
          >
            Strategic Counsel
          </button>
        </div>
      </div>

      {/* 3. Main Chat Layout */}
      <div className="chatbot-body">
        {/* History Sidebar */}
        {showHistory && (
          <aside className="chatbot-history-sidebar">
            <div className="chatbot-history-header">
              <span>Past Consultations</span>
              <button
                type="button"
                className="chatbot-action-btn"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={fetchSessions}
              >
                <RefreshCw size={12} />
              </button>
            </div>
            <div className="chatbot-history-list">
              {sessions.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>
                  No prior consultations saved.
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.session_id}
                    className={`chatbot-history-item ${currentSessionId === s.session_id ? 'active' : ''}`}
                    onClick={() => loadSession(s.session_id)}
                  >
                    <div className="chatbot-history-title" title={s.title}>
                      {s.title}
                    </div>
                    <div className="chatbot-history-meta">
                      <span>{s.case_number || 'General Case'}</span>
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                        onClick={(e) => handleDeleteSession(e, s.session_id)}
                        title="Delete Session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Messages Stream */}
        <main className="chatbot-messages-area">
          {messages.length === 0 && (
            <div className="chatbot-welcome-banner">
              <div className="chatbot-welcome-icon">
                <Bot size={28} />
              </div>
              <h4 className="chatbot-welcome-title">Legal Case Intelligence Assistant</h4>
              <p className="chatbot-welcome-desc">
                Ask questions regarding uploaded petitions, contracts, hearing schedules, and assigned tasks.
                All responses are strictly grounded in real case filings with verified source citations.
              </p>

              {suggestedPrompts.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginBottom: '0.75rem' }}>
                    Suggested Legal Inquiries:
                  </div>
                  <div className="chatbot-prompt-chips-grid">
                    {suggestedPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="chatbot-prompt-chip"
                        onClick={() => handleSendQuery(p)}
                      >
                        <Sparkles size={13} style={{ color: '#B99A5B' }} />
                        <span>{p}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const citations = msg.citations || [];
            const isCitationsOpen = !!expandedCitations[index];

            return (
              <div key={index} className={`chat-message-row ${isUser ? 'user' : 'assistant'}`}>
                <div className={`chat-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
                  {isUser ? (user?.full_name?.charAt(0) || 'U') : <Scale size={18} />}
                </div>

                <div className="chat-bubble-container">
                  <div className="chat-bubble">
                    <MarkdownRenderer content={msg.content} />

                    {/* Citations Drawer */}
                    {!isUser && citations.length > 0 && (
                      <div className="chat-citations-wrapper">
                        <button
                          type="button"
                          className="chat-citations-header"
                          onClick={() => toggleCitations(index)}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <FileText size={14} style={{ color: '#B99A5B' }} />
                            <span>Cited Sources ({citations.length})</span>
                          </span>
                          {isCitationsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>

                        {isCitationsOpen && (
                          <div className="chat-citations-list">
                            {citations.map((c, cIdx) => (
                              <div key={cIdx} className="chat-citation-card">
                                <div className="chat-citation-card-header">
                                  <span>{c.source} &bull; <strong style={{ color: '#B99A5B' }}>{c.ref}</strong></span>
                                  <span className="chat-citation-score-badge">
                                    Relevance: {Math.round(c.score * 100) > 100 ? '98%' : `${Math.round(c.score * 100)}%`}
                                  </span>
                                </div>
                                <div className="chat-citation-snippet">
                                  &ldquo;{c.snippet}&rdquo;
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="chat-message-meta">
                    <span>
                      {isUser ? (user?.full_name || 'Counsel') : (msg.model ? `Model: ${msg.model}` : 'Legal AI')}
                    </span>
                    <span>&bull;</span>
                    <span>
                      {msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>

                    {!isUser && (
                      <div className="chat-action-bar">
                        <button
                          type="button"
                          className="chat-copy-btn"
                          onClick={() => handleCopy(msg.content, index)}
                          title="Copy Answer"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check size={13} style={{ color: '#22C55E' }} />
                              <span style={{ color: '#22C55E' }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="chat-message-row assistant">
              <div className="chat-avatar ai-avatar">
                <Scale size={18} />
              </div>
              <div className="chat-bubble-container">
                <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#64748B' }}>
                  <RefreshCw size={16} className="animate-spin" style={{ color: '#B99A5B' }} />
                  <span>Retrieving case filings & generating cited legal analysis...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>
      </div>

      {/* 4. Input Footer */}
      <footer className="chatbot-footer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
        >
          <div className="chatbot-input-wrapper">
            <textarea
              className="chatbot-textarea"
              placeholder="Ask a question about this case, filings, hearings, or contract clauses (e.g., 'What are the termination liabilities under the SLA?')..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendQuery();
                }
              }}
              rows={1}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={!inputQuery.trim() || sending}
              title="Send Legal Inquiry"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <div className="chatbot-disclaimer-note">
          AI-generated case intelligence for research and advocacy assistance only. Always verify critical statutory interpretations with supervising advocate.
        </div>
      </footer>
    </div>
  );

  if (isModal) {
    return (
      <div className="legal-chatbot-modal-overlay" onClick={onClose}>
        <div className="legal-chatbot-modal-window" onClick={(e) => e.stopPropagation()}>
          {chatbotInner}
        </div>
      </div>
    );
  }

  return chatbotInner;
}
