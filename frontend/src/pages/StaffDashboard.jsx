import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Scale,
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  Calendar,
  FileText,
  CheckCircle2,
  User,
  LogOut,
  Bell,
  Search,
  Filter,
  Eye,
  Edit3,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Clock,
  X,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Menu,
  Download,
  Save,
  Check,
  ArrowRight,
  FileCheck,
  Award,
  Layers,
  List,
  Grid,
  CalendarDays,
  FileSpreadsheet,
  FileCode,
  FolderOpen,
  Gavel,
  CheckSquare,
  Sparkles,
  Copy,
  RotateCcw,
  UserCheck,
  Info,
  Bot,
  Send
} from 'lucide-react';
import '../styles/Dashboard.css';
import LegalAssistantChatbot from '../components/LegalAssistantChatbot';

export default function StaffDashboard() {
  const { user, logout, csrfToken } = useAuth();

  // Navigation state
  const [activeNav, setActiveNav] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAiAssistantModal, setShowAiAssistantModal] = useState(false);

  // Global Feedback Banner
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 5000);
  };

  // --------------------------------------------------------------------------
  // 1. DASHBOARD OVERVIEW STATE
  // --------------------------------------------------------------------------
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch('/api/staff/overview', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setOverviewData(data);
      } else {
        setOverviewError(data.error || 'Failed to retrieve staff overview.');
      }
    } catch (err) {
      setOverviewError('Could not connect to firm system. Please check your network connection.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // --------------------------------------------------------------------------
  // 2. ASSIGNED CASES STATE & LOGIC (PAGE 1)
  // --------------------------------------------------------------------------
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState(null);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState('ALL');
  const [caseTypeFilter, setCaseTypeFilter] = useState('ALL');
  const [caseUrgencyFilter, setCaseUrgencyFilter] = useState('ALL');
  const [casesViewMode, setCasesViewMode] = useState('table'); // 'table' | 'cards'

  // Case Details Modal State
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseModalLoading, setCaseModalLoading] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [caseModalTab, setCaseModalTab] = useState('info');

  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      const params = new URLSearchParams();
      if (caseSearch.trim()) params.append('q', caseSearch.trim());
      if (caseStatusFilter !== 'ALL') params.append('status', caseStatusFilter);
      if (caseTypeFilter !== 'ALL') params.append('case_type', caseTypeFilter);

      const res = await fetch(`/api/staff/cases?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setCases(data.cases || []);
      } else {
        setCasesError(data.error || 'Failed to load assigned cases.');
      }
    } catch (err) {
      setCasesError('Network error retrieving assigned cases.');
    } finally {
      setCasesLoading(false);
    }
  }, [caseSearch, caseStatusFilter, caseTypeFilter]);

  useEffect(() => {
    if (activeNav === 'cases' || activeNav === 'dashboard' || activeNav === 'documents' || activeNav === 'tasks' || activeNav === 'completed') {
      fetchCases();
    }
  }, [activeNav, fetchCases]);

  const openCaseDetails = async (caseId) => {
    setShowCaseModal(true);
    setCaseModalLoading(true);
    setCaseModalTab('info');
    setSelectedCase(null);
    try {
      const res = await fetch(`/api/staff/cases/${caseId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setSelectedCase(data);
      } else {
        showFeedback('error', data.error || 'Could not load case file details.');
        setShowCaseModal(false);
      }
    } catch (err) {
      showFeedback('error', 'Network error retrieving case details.');
      setShowCaseModal(false);
    } finally {
      setCaseModalLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 3. CASE DOCUMENTS STATE & LOGIC (PAGE 2)
  // --------------------------------------------------------------------------
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState(null);
  const [docSearch, setDocSearch] = useState('');
  const [docCaseFilter, setDocCaseFilter] = useState('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [docDateFilter, setDocDateFilter] = useState('ALL');
  const [docViewMode, setDocViewMode] = useState('table'); // 'table' | 'cards'
  const [docAssignmentFilter, setDocAssignmentFilter] = useState('ASSIGNED_TO_ME'); // 'ASSIGNED_TO_ME' | 'ALL_AUTHORIZED'

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const params = new URLSearchParams();
      if (docSearch.trim()) params.append('q', docSearch.trim());
      if (docCaseFilter !== 'ALL') params.append('case_id', docCaseFilter);
      if (docTypeFilter !== 'ALL') params.append('file_type', docTypeFilter);
      if (docAssignmentFilter === 'ASSIGNED_TO_ME' || activeNav === 'assigned_documents') {
        params.append('assigned_to_me', '1');
      }

      const res = await fetch(`/api/staff/documents?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      } else {
        setDocumentsError(data.error || 'Failed to load authorized documents.');
      }
    } catch (err) {
      setDocumentsError('Network error retrieving documents.');
    } finally {
      setDocumentsLoading(false);
    }
  }, [docSearch, docCaseFilter, docTypeFilter, docAssignmentFilter, activeNav]);

  useEffect(() => {
    if (activeNav === 'documents' || activeNav === 'assigned_documents' || activeNav === 'dashboard') {
      fetchDocuments();
    }
  }, [activeNav, fetchDocuments]);

  const handleDownloadDocument = (documentId, fileName) => {
    window.open(`/api/staff/documents/${documentId}/download`, '_blank');
  };

  const handleOpenDocumentPreview = useCallback(async (doc) => {
    setPreviewDoc(doc);
    setShowPreviewModal(true);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch(`/api/staff/documents/${doc.document_id}/preview`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setPreviewDoc(data);
      } else {
        setPreviewError(data.error || 'Failed to retrieve document preview.');
      }
    } catch {
      setPreviewError('Network error connecting to document preview service.');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // 3.1 GROK AI DOCUMENT SUMMARY STATE & HANDLERS
  // --------------------------------------------------------------------------
  const [summaryDoc, setSummaryDoc] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryViewMode, setSummaryViewMode] = useState('sections'); // 'sections' | 'full'
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [selectedPreferenceId, setSelectedPreferenceId] = useState('pref_1');
  const [savingPreference, setSavingPreference] = useState(false);

  const openDocumentSummaryModal = useCallback(async (doc) => {
    setSummaryDoc(doc);
    setShowSummaryModal(true);
    setSummaryError(null);
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await fetch(`/api/staff/documents/${doc.document_id}/summary`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.has_summary) {
        setSummaryData(data.summary);
        if (data.summary.active_preference_id) {
          setSelectedPreferenceId(data.summary.active_preference_id);
        }
      }
    } catch (err) {
      // Non-blocking retrieval check
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const handleGenerateSummary = async (regenerate = false) => {
    if (!summaryDoc) return;
    setSummaryGenerating(true);
    setSummaryError(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch(`/api/staff/documents/${summaryDoc.document_id}/summary`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ regenerate })
      });
      const data = await res.json();
      if (res.ok) {
        setSummaryData(data.summary);
        if (data.summary.active_preference_id) {
          setSelectedPreferenceId(data.summary.active_preference_id);
        }
        showFeedback('success', `Dual AI legal briefs generated successfully for "${summaryDoc.file_name}".`);
        fetchDocuments(); // Refresh documents to reflect ANALYZED status immediately
      } else {
        setSummaryError(data.error || 'Failed to generate summary.');
      }
    } catch (err) {
      setSummaryError('Network error while requesting AI summary.');
    } finally {
      setSummaryGenerating(false);
    }
  };

  const handleSelectPreference = async (prefId) => {
    if (!summaryDoc || !prefId) return;
    setSavingPreference(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch(`/api/staff/documents/${summaryDoc.document_id}/summary/preference`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ preference_id: prefId })
      });
      const data = await res.json();
      if (res.ok) {
        setSummaryData(data.summary);
        setSelectedPreferenceId(prefId);
        showFeedback('success', data.message || 'Preferred summary selected as the official case brief.');
        fetchDocuments();
      } else {
        showFeedback('error', data.error || 'Failed to set preference.');
      }
    } catch (err) {
      showFeedback('error', 'Network error while setting preference.');
    } finally {
      setSavingPreference(false);
    }
  };

  const currentPreference = useMemo(() => {
    if (!summaryData) return null;
    const prefs = summaryData.preferences;
    if (!prefs || prefs.length === 0) {
      return {
        id: 'pref_1',
        label: 'Preference 1: Comprehensive Brief',
        model: summaryData.model,
        summary_text: summaryData.summary_text,
        structured_sections: summaryData.structured_sections
      };
    }
    return prefs.find((p) => p.id === selectedPreferenceId) || prefs[0];
  }, [summaryData, selectedPreferenceId]);

  const handleCopySummary = () => {
    const textToCopy = currentPreference?.summary_text || summaryData?.summary_text;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // --------------------------------------------------------------------------
  // 4. RESEARCH TASKS STATE & LOGIC (PAGE 3)
  // --------------------------------------------------------------------------
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('ALL');
  const [taskCaseFilter, setTaskCaseFilter] = useState('ALL');
  const [tasksViewMode, setTasksViewMode] = useState('list'); // 'list' | 'board'

  // Task Details & Notes Modal State
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskNotesInput, setTaskNotesInput] = useState('');
  const [taskStatusInput, setTaskStatusInput] = useState('PENDING');
  const [savingTask, setSavingTask] = useState(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const params = new URLSearchParams();
      if (taskSearch.trim()) params.append('q', taskSearch.trim());
      if (taskStatusFilter !== 'ALL') params.append('status', taskStatusFilter);
      if (taskPriorityFilter !== 'ALL') params.append('priority', taskPriorityFilter);
      if (taskCaseFilter !== 'ALL') params.append('case_id', taskCaseFilter);

      const res = await fetch(`/api/staff/tasks?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks || []);
      } else {
        setTasksError(data.error || 'Failed to load research tasks.');
      }
    } catch (err) {
      setTasksError('Network error retrieving research tasks.');
    } finally {
      setTasksLoading(false);
    }
  }, [taskSearch, taskStatusFilter, taskPriorityFilter, taskCaseFilter]);

  useEffect(() => {
    if (activeNav === 'tasks' || activeNav === 'completed' || activeNav === 'dashboard') {
      fetchTasks();
    }
  }, [activeNav, fetchTasks]);

  const [modalTaskError, setModalTaskError] = useState(null);

  const openTaskModal = (task) => {
    setSelectedTask(task);
    setTaskNotesInput(task.research_notes || '');
    setTaskStatusInput(task.status || 'PENDING');
    setModalTaskError(null);
    setShowTaskModal(true);
  };

  // Row-level status drafts and submission state for Research Tasks
  const [statusDrafts, setStatusDrafts] = useState({});
  const [submittingTaskId, setSubmittingTaskId] = useState(null);

  const handleSelectRowStatus = (taskId, newStatus) => {
    setStatusDrafts((prev) => ({
      ...prev,
      [taskId]: newStatus
    }));
  };

  const handleRowStatusSubmit = async (taskId, targetStatus) => {
    setSubmittingTaskId(taskId);
    try {
      const res = await fetch(`/api/staff/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
          'X-CSRFToken': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ status: targetStatus })
      });
      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        // non-json response
      }
      if (res.ok) {
        const readable = targetStatus.replace('_', ' ');
        showFeedback(
          'success',
          `Task status "${readable}" successfully submitted! Supervising Advocate will see this updated status.`
        );
        setStatusDrafts((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        fetchTasks();
        fetchOverview();
      } else {
        showFeedback('error', data.error || `Failed to update task status (HTTP ${res.status}).`);
      }
    } catch (err) {
      showFeedback('error', 'Network error submitting task status to advocate.');
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const handleQuickStatusChange = async (taskId, newStatus) => {
    return handleRowStatusSubmit(taskId, newStatus);
  };

  const executeSaveTask = async () => {
    if (!selectedTask) return;
    setSavingTask(true);
    setModalTaskError(null);
    try {
      // 1. Save Research Notes
      const notesRes = await fetch(`/api/staff/tasks/${selectedTask.task_id}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
          'X-CSRFToken': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({
          research_notes: taskNotesInput,
          notes: taskNotesInput
        })
      });
      let notesData = {};
      try {
        notesData = await notesRes.json();
      } catch (e) {
        // non-json response
      }
      if (!notesRes.ok) {
        const errorMsg = notesData.error || `Failed to save research notes (HTTP ${notesRes.status}).`;
        showFeedback('error', errorMsg);
        setModalTaskError(errorMsg);
        setSavingTask(false);
        return;
      }

      // 2. Always sync Status & timestamp to Advocate
      const statusRes = await fetch(`/api/staff/tasks/${selectedTask.task_id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
          'X-CSRFToken': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ status: taskStatusInput })
      });
      let statusData = {};
      try {
        statusData = await statusRes.json();
      } catch (e) {
        // non-json response
      }
      if (!statusRes.ok) {
        const errorMsg = statusData.error || `Failed to update status (HTTP ${statusRes.status}).`;
        showFeedback('error', errorMsg);
        setModalTaskError(errorMsg);
        setSavingTask(false);
        return;
      }

      showFeedback(
        'success',
        `Research notes and task status (${taskStatusInput.replace('_', ' ')}) successfully submitted to supervising Advocate!`
      );
      setShowTaskModal(false);
      setShowCompletionConfirm(false);
      fetchTasks();
      fetchOverview();
    } catch (err) {
      const errorMsg = 'Network error saving task details. Please check server connection.';
      showFeedback('error', errorMsg);
      setModalTaskError(errorMsg);
    } finally {
      setSavingTask(false);
    }
  };

  const handleSaveTaskDetails = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    executeSaveTask();
  };

  // --------------------------------------------------------------------------
  // 5. HEARINGS & DEADLINES STATE & LOGIC (PAGE 4)
  // --------------------------------------------------------------------------
  const [deadlines, setDeadlines] = useState([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(false);
  const [deadlinesError, setDeadlinesError] = useState(null);
  const [deadlineTypeFilter, setDeadlineTypeFilter] = useState('ALL');
  const [deadlineTimeFilter, setDeadlineTimeFilter] = useState('ALL');
  const [deadlinesViewMode, setDeadlinesViewMode] = useState('list'); // 'list' | 'calendar'

  // Interactive Calendar State
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedCalendarDayEvents, setSelectedCalendarDayEvents] = useState(null);

  const fetchDeadlines = useCallback(async () => {
    setDeadlinesLoading(true);
    setDeadlinesError(null);
    try {
      const params = new URLSearchParams();
      if (deadlineTypeFilter !== 'ALL') params.append('type', deadlineTypeFilter);

      const res = await fetch(`/api/staff/deadlines?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setDeadlines(data.deadlines || []);
      } else {
        setDeadlinesError(data.error || 'Failed to load deadlines.');
      }
    } catch (err) {
      setDeadlinesError('Network error retrieving deadlines.');
    } finally {
      setDeadlinesLoading(false);
    }
  }, [deadlineTypeFilter]);

  useEffect(() => {
    if (activeNav === 'deadlines' || activeNav === 'dashboard') {
      fetchDeadlines();
    }
  }, [activeNav, fetchDeadlines]);

  // Calendar Helpers
  const nextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
    setSelectedCalendarDayEvents(null);
  };

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
    setSelectedCalendarDayEvents(null);
  };

  const goToToday = () => {
    setCurrentCalendarDate(new Date());
    setSelectedCalendarDayEvents(null);
  };

  const calendarDays = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Preceding month filler days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthDays - i,
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      days.push({
        dayNumber: d,
        date: new Date(year, month, d),
        isCurrentMonth: true
      });
    }

    // Trailing month filler days to complete rows of 7
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let n = 1; n <= remaining; n++) {
        days.push({
          dayNumber: n,
          date: new Date(year, month + 1, n),
          isCurrentMonth: false
        });
      }
    }

    return days;
  }, [currentCalendarDate]);

  // --------------------------------------------------------------------------
  // 6. COMPLETED WORK STATE & LOGIC (PAGE 5)
  // --------------------------------------------------------------------------
  const [completedSearch, setCompletedSearch] = useState('');
  const [completedCaseFilter, setCompletedCaseFilter] = useState('ALL');
  const [completedDateRange, setCompletedDateRange] = useState('ALL');
  const [selectedCompletedDossier, setSelectedCompletedDossier] = useState(null);

  // --------------------------------------------------------------------------
  // HELPER FORMATTING & URGENCY LOGIC
  // --------------------------------------------------------------------------
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not Scheduled';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'OPEN':
        return 'badge-status-open';
      case 'PENDING':
        return 'badge-status-pending';
      case 'IN_PROGRESS':
        return 'badge-status-progress';
      case 'COMPLETED':
      case 'CLOSED':
      case 'DISPOSED':
        return 'badge-status-closed';
      case 'PENDING_HEARING':
      case 'IN_TRIAL':
        return 'badge-status-trial';
      default:
        return 'badge-status-open';
    }
  };

  const getUrgency = (dateStr) => {
    if (!dateStr) return { label: 'Scheduled', className: 'upcoming' };
    try {
      const target = new Date(dateStr).getTime();
      const now = Date.now();
      const diffHours = (target - now) / (1000 * 60 * 60);
      if (diffHours < 0) {
        return { label: 'Overdue', className: 'overdue' };
      } else if (diffHours <= 24) {
        return { label: "Today's Event", className: 'approaching' };
      } else if (diffHours <= 72) {
        return { label: 'Approaching', className: 'approaching' };
      } else {
        return { label: 'Upcoming', className: 'upcoming' };
      }
    } catch {
      return { label: 'Scheduled', className: 'upcoming' };
    }
  };

  // --------------------------------------------------------------------------
  // COMPUTED DATA FOR SUMMARY CARDS & FILTERS
  // --------------------------------------------------------------------------

  // Page 1: Cases Computed Metrics & Filters
  const casesSummary = useMemo(() => {
    const total = cases.length;
    const active = cases.filter((c) => ['OPEN', 'PENDING_HEARING', 'IN_TRIAL'].includes(c.case_status)).length;
    const dueSoon = cases.filter((c) => {
      if (!c.deadline) return false;
      const diff = (new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 14;
    }).length;
    const completed = cases.filter((c) => ['CLOSED', 'DISPOSED'].includes(c.case_status)).length;
    return { total, active, dueSoon, completed };
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (caseUrgencyFilter === 'DUE_SOON') {
        if (!c.deadline) return false;
        const diff = (new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 14;
      }
      if (caseUrgencyFilter === 'OVERDUE') {
        if (!c.deadline) return false;
        return new Date(c.deadline).getTime() < Date.now();
      }
      return true;
    });
  }, [cases, caseUrgencyFilter]);

  // Page 2: Documents Computed Metrics & Filters
  const docSummary = useMemo(() => {
    const total = documents.length;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = documents.filter((d) => d.uploaded_at && new Date(d.uploaded_at).getTime() >= thirtyDaysAgo).length;
    // Documents tied to active cases needing research
    const requiringReview = documents.filter((d) => {
      const matchedCase = cases.find((c) => c.case_id === d.case_id);
      return matchedCase && matchedCase.pending_tasks_count > 0;
    }).length;
    const reviewed = total - requiringReview;
    return { total, recent, requiringReview, reviewed };
  }, [documents, cases]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (docDateFilter === '7_DAYS') {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return doc.uploaded_at && new Date(doc.uploaded_at).getTime() >= sevenDaysAgo;
      }
      if (docDateFilter === '30_DAYS') {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return doc.uploaded_at && new Date(doc.uploaded_at).getTime() >= thirtyDaysAgo;
      }
      return true;
    });
  }, [documents, docDateFilter]);

  // Page 3: Tasks Computed Metrics & Kanban Columns
  const tasksSummary = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'PENDING').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    const overdue = tasks.filter((t) => t.status !== 'COMPLETED' && t.due_date && new Date(t.due_date).getTime() < Date.now()).length;
    return { pending, inProgress, completed, overdue };
  }, [tasks]);

  const kanbanColumns = useMemo(() => {
    return {
      pending: tasks.filter((t) => t.status === 'PENDING'),
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS'),
      completed: tasks.filter((t) => t.status === 'COMPLETED')
    };
  }, [tasks]);

  // Page 4: Deadlines Computed Metrics & Filters
  const deadlinesSummary = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const todayEvents = deadlines.filter((d) => d.deadline_date && d.deadline_date.startsWith(todayStr)).length;
    const upcomingHearings = deadlines.filter((d) => d.item_type === 'HEARING' && new Date(d.deadline_date).getTime() >= Date.now()).length;
    const upcomingTasks = deadlines.filter((d) => d.item_type === 'TASK' && new Date(d.deadline_date).getTime() >= Date.now()).length;
    const overdueItems = deadlines.filter((d) => d.deadline_date && new Date(d.deadline_date).getTime() < Date.now()).length;

    return { todayEvents, upcomingHearings, upcomingTasks, overdueItems };
  }, [deadlines]);

  const filteredDeadlines = useMemo(() => {
    return deadlines.filter((d) => {
      if (deadlineTimeFilter === 'OVERDUE') {
        return d.deadline_date && new Date(d.deadline_date).getTime() < Date.now();
      }
      if (deadlineTimeFilter === 'TODAY') {
        const todayStr = new Date().toISOString().split('T')[0];
        return d.deadline_date && d.deadline_date.startsWith(todayStr);
      }
      if (deadlineTimeFilter === 'THIS_WEEK') {
        const target = new Date(d.deadline_date).getTime();
        const diff = (target - Date.now()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      }
      return true;
    });
  }, [deadlines, deadlineTimeFilter]);

  // Page 5: Completed Work Computed Metrics & Filters
  const completedTasksList = useMemo(() => {
    return tasks.filter((t) => t.status === 'COMPLETED');
  }, [tasks]);

  const closedCasesList = useMemo(() => {
    return cases.filter((c) => c.case_status === 'CLOSED' || c.case_status === 'DISPOSED');
  }, [cases]);

  const completedSummary = useMemo(() => {
    const total = completedTasksList.length;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const thisMonth = completedTasksList.filter((t) => {
      const d = new Date(t.updated_at || t.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const notesSubmitted = completedTasksList.filter((t) => t.research_notes && t.research_notes.trim().length > 0).length;

    const onTime = completedTasksList.filter((t) => {
      if (!t.due_date || !t.updated_at) return true;
      return new Date(t.updated_at).getTime() <= new Date(t.due_date).getTime();
    }).length;

    return { total, thisMonth, notesSubmitted, onTime };
  }, [completedTasksList]);

  const filteredCompletedTasks = useMemo(() => {
    return completedTasksList.filter((t) => {
      if (completedSearch.trim()) {
        const q = completedSearch.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCase = (t.case_number || '').toLowerCase().includes(q) || (t.case_title || '').toLowerCase().includes(q);
        const matchNotes = (t.research_notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCase && !matchNotes) return false;
      }
      if (completedCaseFilter !== 'ALL') {
        if (String(t.case_id) !== String(completedCaseFilter)) return false;
      }
      return true;
    });
  }, [completedTasksList, completedSearch, completedCaseFilter]);

  return (
    <div className="dashboard-layout">
      {/* ------------------------------------------------------------ */}
      {/* 1. SIDEBAR NAVIGATION (Matching Advocate Dashboard)          */}
      {/* ------------------------------------------------------------ */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'open' : ''}`} role="navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Scale size={22} strokeWidth={2.4} />
          </div>
          <div className="sidebar-brand-text">
            <h1>Legal CaseBook</h1>
            <span>Staff Workspace</span>
          </div>
        </div>

        <div className="sidebar-nav-container">
          <div className="sidebar-nav-group-title">Command Center</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'dashboard' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('dashboard');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><LayoutDashboard size={18} /></span>
                <span>Dashboard</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-nav-group-title">Assigned Matters</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'cases' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('cases');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><Briefcase size={18} /></span>
                <span>My Assigned Cases</span>
              </button>
            </li>
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'assigned_documents' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('assigned_documents');
                  setDocAssignmentFilter('ASSIGNED_TO_ME');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><FileCheck size={18} /></span>
                <span>Documents Assigned to Me</span>
              </button>
            </li>
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'documents' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('documents');
                  setDocAssignmentFilter('ALL_AUTHORIZED');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><FileText size={18} /></span>
                <span>All Case Documents</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-nav-group-title">Research & Tasks</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'tasks' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('tasks');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><ClipboardList size={18} /></span>
                <span>Research Tasks</span>
              </button>
            </li>
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'deadlines' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('deadlines');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><Calendar size={18} /></span>
                <span>Hearings & Deadlines</span>
              </button>
            </li>
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'completed' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('completed');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><CheckCircle2 size={18} /></span>
                <span>Completed Work</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-nav-group-title">AI Intelligence</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'chatbot' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('chatbot');
                  setMobileMenuOpen(false);
                }}
                style={{
                  background: activeNav === 'chatbot' ? 'linear-gradient(135deg, rgba(185, 154, 91, 0.15) 0%, rgba(23, 43, 77, 0.08) 100%)' : 'transparent',
                  borderLeft: activeNav === 'chatbot' ? '3px solid #B99A5B' : 'none'
                }}
              >
                <span className="sidebar-nav-icon"><Bot size={18} style={{ color: '#B99A5B' }} /></span>
                <span>AI Legal Assistant</span>
                <span style={{ marginLeft: 'auto', background: '#22C55E', color: '#FFFFFF', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '9999px', fontWeight: 700 }}>AI</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-nav-group-title">Account & System</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'profile' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('profile');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><User size={18} /></span>
                <span>My Profile</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            title="Terminate session"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------ */}
      {/* 2. MAIN WORKSPACE CONTENT AREA                               */}
      {/* ------------------------------------------------------------ */}
      <div className="dashboard-main-wrapper">
        {/* Top Header / App Bar */}
        <header className="dashboard-topbar" role="banner">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <Menu size={22} />
            </button>
            <div className="topbar-page-info">
              <h2>
                {activeNav === 'dashboard' && 'Staff Dashboard'}
                {activeNav === 'cases' && 'My Assigned Cases'}
                {activeNav === 'documents' && 'Case Documents'}
                {activeNav === 'tasks' && 'Research Tasks'}
                {activeNav === 'deadlines' && 'Hearings & Deadlines'}
                {activeNav === 'completed' && 'Completed Work'}
                {activeNav === 'profile' && 'Staff Profile & Credentials'}
              </h2>
              <span>Firm Vault Connected • Secure TLS Session</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Notification Bell with Live Feed Popover */}
            <div className="topbar-notifications">
              <button
                type="button"
                className="btn-icon-notify"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="View notifications"
              >
                <Bell size={18} />
                {(overviewData?.metrics?.pending_tasks > 0 || overviewData?.metrics?.upcoming_deadlines > 0) && (
                  <span className="notify-badge-dot" />
                )}
              </button>

              {showNotifications && (
                <div className="notify-popover">
                  <div className="notify-popover-header">
                    <h4>Operational Alerts</h4>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>Live</span>
                  </div>
                  <div className="notify-popover-list">
                    <div className="notify-item">
                      <strong>Security Clearance Verified</strong>
                      <p style={{ margin: '2px 0 0 0' }}>Staff clearance active for authenticated assigned cases.</p>
                      <div className="notify-item-time">Active Session</div>
                    </div>
                    {overviewData?.metrics?.pending_tasks > 0 && (
                      <div className="notify-item">
                        <strong>Pending Tasks Awaiting Action</strong>
                        <p style={{ margin: '2px 0 0 0' }}>
                          You have {overviewData.metrics.pending_tasks} research task(s) awaiting your work.
                        </p>
                        <div className="notify-item-time">Action Required</div>
                      </div>
                    )}
                    {overviewData?.metrics?.upcoming_deadlines > 0 && (
                      <div className="notify-item">
                        <strong>Upcoming Deadlines</strong>
                        <p style={{ margin: '2px 0 0 0' }}>
                          {overviewData.metrics.upcoming_deadlines} hearing or task due date(s) on your assigned ledger.
                        </p>
                        <div className="notify-item-time">Calendar Notice</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Topbar AI Assistant Button */}
            <button
              type="button"
              className="btn-topbar-action"
              onClick={() => setShowAiAssistantModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #172B4D 0%, #0F1E36 100%)',
                color: '#FFFFFF',
                border: '1.5px solid #B99A5B',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(185, 154, 91, 0.25)',
                transition: 'all 0.2s ease'
              }}
              title="Open Legal AI Assistant"
            >
              <Sparkles size={15} style={{ color: '#B99A5B' }} />
              <span>AI Assistant</span>
              <span style={{ background: '#22C55E', color: '#FFFFFF', fontSize: '0.65rem', padding: '0.05rem 0.35rem', borderRadius: '9999px', fontWeight: 700 }}>AI</span>
            </button>

            {/* Profile Identity Chip */}
            <div
              className="topbar-profile-chip"
              onClick={() => setActiveNav('profile')}
              style={{ cursor: 'pointer' }}
              title="View Staff Profile"
            >
              <div className="profile-avatar-circle" aria-hidden="true">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div className="profile-meta">
                <span className="profile-name">{user?.full_name || 'Staff Member'}</span>
                <span className="profile-badge-tag">Verified Staff</span>
              </div>
            </div>

            {/* Topbar Sign Out Button */}
            <button
              type="button"
              className="btn-topbar-signout"
              onClick={() => setShowLogoutConfirm(true)}
              title="Sign Out"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Global Feedback Banner */}
        {feedback.message && (
          <div className={`feedback-banner ${feedback.type}`} role="alert" style={{ margin: '16px 32px 0' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback({ type: '', message: '' })}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content Area */}
        <main className="dashboard-content-area" role="main">
          {/* ========================================================== */}
          {/* VIEW: AI LEGAL ASSISTANT (RAG CHATBOT)                     */}
          {/* ========================================================== */}
          {activeNav === 'chatbot' && (
            <div style={{ height: 'calc(100vh - 120px)', minHeight: '680px', margin: '0 0 2rem 0' }}>
              <LegalAssistantChatbot />
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 0: DASHBOARD OVERVIEW                                 */}
          {/* ========================================================== */}
          {activeNav === 'dashboard' && (
            <div>
              {/* Hero Banner Section */}
              <div className="advocate-hero-card">
                <div className="hero-info-section">
                  <h3>Welcome back, {user?.full_name || 'Staff Member'}</h3>
                  <p>
                    Manage your assigned cases, track research tasks, and stay on top of upcoming deadlines.
                  </p>
                </div>
                <div className="hero-security-pill">
                  <ShieldCheck size={16} />
                  <span>Staff Operational Clearance</span>
                </div>
              </div>

              {/* Database Error Banner */}
              {overviewError && (
                <div className="db-error-alert" role="alert">
                  <AlertTriangle size={24} className="db-error-icon" />
                  <div className="db-error-body">
                    <h4>Firm Network Connection Notice</h4>
                    <p>{overviewError}</p>
                    <button type="button" className="btn-retry-conn" onClick={fetchOverview}>
                      <RefreshCw size={14} />
                      <span>Retry Connection</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 6 Summary Metric Cards */}
              <div className="metrics-grid-6">
                <div
                  className="metric-card navy-accent clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setActiveNav('cases'); setCaseStatusFilter('ALL'); }}
                >
                  <div className="metric-card-header">
                    <span className="metric-card-title">My Assigned Cases</span>
                    <div className="metric-card-icon"><Briefcase size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.assigned_cases : '—')}
                  </div>
                  <div className="metric-card-footer">
                    <span>Allocated by Advocates</span>
                    <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#B99A5B' }} />
                  </div>
                </div>

                <div
                  className="metric-card gold-accent clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setActiveNav('cases'); setCaseStatusFilter('OPEN'); }}
                >
                  <div className="metric-card-header">
                    <span className="metric-card-title">Active Case Files</span>
                    <div className="metric-card-icon"><Clock size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.active_cases : '—')}
                  </div>
                  <div className="metric-card-footer">
                    <span>Open & In Trial</span>
                    <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#B99A5B' }} />
                  </div>
                </div>

                <div
                  className="metric-card gold-accent clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setActiveNav('tasks'); setTaskStatusFilter('PENDING'); }}
                >
                  <div className="metric-card-header">
                    <span className="metric-card-title">Pending Tasks</span>
                    <div className="metric-card-icon"><AlertCircle size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.pending_tasks : '—')}
                  </div>
                  <div className="metric-card-footer">
                    <span>Awaiting your research</span>
                    <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#B99A5B' }} />
                  </div>
                </div>

                <div
                  className="metric-card navy-accent clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setActiveNav('tasks'); setTaskStatusFilter('IN_PROGRESS'); }}
                >
                  <div className="metric-card-header">
                    <span className="metric-card-title">In Progress Tasks</span>
                    <div className="metric-card-icon"><Edit3 size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.in_progress_tasks : '—')}
                  </div>
                  <div className="metric-card-footer">
                    <span>Active drafting & inquiry</span>
                    <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#B99A5B' }} />
                  </div>
                </div>

                <div
                  className="metric-card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveNav('completed')}
                >
                  <div className="metric-card-header">
                    <span className="metric-card-title">Completed Tasks</span>
                    <div className="metric-card-icon"><CheckCircle2 size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.completed_tasks : '—')}
                  </div>
                  <div className="metric-card-footer">
                    <span>Archived with notes</span>
                    <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#B99A5B' }} />
                  </div>
                </div>

                <div
                  className="metric-card gold-accent clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveNav('deadlines')}
                >
                  <div className="metric-card-header">
                    <span className="metric-card-title">Upcoming Deadlines</span>
                    <div className="metric-card-icon"><Calendar size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.upcoming_deadlines : '—')}
                  </div>
                  <div className="metric-card-footer">
                    <span>Hearings & due dates</span>
                    <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#B99A5B' }} />
                  </div>
                </div>
              </div>

              {/* Streams Grid: Recent Assignments & Deadlines */}
              <div className="dashboard-streams-grid">
                <div className="stream-card">
                  <div className="stream-card-header">
                    <h3><Briefcase size={16} /> Recent Case Assignments</h3>
                    <button type="button" className="btn-stream-link" onClick={() => setActiveNav('cases')}>
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="stream-card-body">
                    {overviewData?.recent_assignments && overviewData.recent_assignments.length > 0 ? (
                      <table className="stream-table">
                        <thead>
                          <tr>
                            <th>Case #</th>
                            <th>Case Title</th>
                            <th>Advocate</th>
                            <th>Deadline</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData.recent_assignments.map((item) => (
                            <tr key={item.assignment_id}>
                              <td style={{ fontWeight: 600, color: '#172B4D', fontFamily: 'monospace' }}>
                                {item.case_number}
                              </td>
                              <td style={{ fontWeight: 600, color: '#1E293B', maxWidth: '180px' }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.case_title}
                                </div>
                              </td>
                              <td>{item.advocate_name}</td>
                              <td>{formatDate(item.deadline)}</td>
                              <td>
                                <span className={`badge-status ${getStatusBadgeClass(item.case_status)}`}>
                                  {item.case_status.replace('_', ' ')}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-action-view"
                                  onClick={() => openCaseDetails(item.case_id)}
                                >
                                  <Eye size={14} />
                                  <span>Details</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty-state-box">
                        <Briefcase size={36} className="empty-state-icon" />
                        <p style={{ margin: 0, fontWeight: 500 }}>No active case assignments found.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="stream-card">
                  <div className="stream-card-header">
                    <h3><Calendar size={16} /> Upcoming Deadlines & Hearings</h3>
                    <button type="button" className="btn-stream-link" onClick={() => setActiveNav('deadlines')}>
                      View Calendar <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="stream-card-body" style={{ padding: '16px' }}>
                    {overviewData?.upcoming_deadlines && overviewData.upcoming_deadlines.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {overviewData.upcoming_deadlines.map((item, idx) => {
                          const urgency = getUrgency(item.deadline_date);
                          return (
                            <div key={idx} className="deadline-feed-item">
                              <div className={`deadline-icon-wrapper ${item.item_type === 'HEARING' ? 'hearing' : 'task'}`}>
                                {item.item_type === 'HEARING' ? <Scale size={18} /> : <ClipboardList size={18} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <h4 style={{ margin: 0, fontSize: '13.5px', color: '#172B4D', fontWeight: 600 }}>
                                    {item.title}
                                  </h4>
                                  <span className={`urgency-badge ${urgency.className}`}>{urgency.label}</span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                                  Case: <strong>{item.case_number}</strong> • {item.case_title}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                  <span style={{ fontSize: '12px', color: '#B99A5B', fontWeight: 600 }}>
                                    Target: {formatDateTime(item.deadline_date)}
                                  </span>
                                  {item.case_id && (
                                    <button
                                      type="button"
                                      className="btn-stream-link"
                                      style={{ fontSize: '12px' }}
                                      onClick={() => openCaseDetails(item.case_id)}
                                    >
                                      View File <ArrowRight size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty-state-box">
                        <Calendar size={36} className="empty-state-icon" />
                        <p style={{ margin: 0, fontWeight: 500 }}>No upcoming court hearings or task deadlines.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 1: MY ASSIGNED CASES (STAGE 6.1 REDESIGN)            */}
          {/* ========================================================== */}
          {activeNav === 'cases' && (
            <div>
              {/* Header */}
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>My Assigned Cases</h2>
                  <p>Manage the cases assigned to you and stay updated on your legal research responsibilities.</p>
                </div>
                <div className="page-header-actions">
                  <div className="view-toggle-group">
                    <button
                      type="button"
                      className={`view-toggle-btn ${casesViewMode === 'table' ? 'active' : ''}`}
                      onClick={() => setCasesViewMode('table')}
                    >
                      <List size={15} />
                      <span>Table</span>
                    </button>
                    <button
                      type="button"
                      className={`view-toggle-btn ${casesViewMode === 'cards' ? 'active' : ''}`}
                      onClick={() => setCasesViewMode('cards')}
                    >
                      <Grid size={15} />
                      <span>Cards</span>
                    </button>
                  </div>
                  <button type="button" className="btn-secondary-action" onClick={fetchCases}>
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="metrics-grid-4">
                <div className="metric-card navy-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Total Assigned</span>
                    <div className="metric-card-icon"><Briefcase size={16} /></div>
                  </div>
                  <div className="metric-card-value">{casesLoading ? '...' : casesSummary.total}</div>
                  <div className="metric-card-footer">Authorized matters on ledger</div>
                </div>
                <div className="metric-card gold-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Active Cases</span>
                    <div className="metric-card-icon"><Clock size={16} /></div>
                  </div>
                  <div className="metric-card-value">{casesLoading ? '...' : casesSummary.active}</div>
                  <div className="metric-card-footer">Open, in trial, or hearing</div>
                </div>
                <div className="metric-card gold-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Cases Due Soon</span>
                    <div className="metric-card-icon"><AlertCircle size={16} /></div>
                  </div>
                  <div className="metric-card-value">{casesLoading ? '...' : casesSummary.dueSoon}</div>
                  <div className="metric-card-footer">Milestone within 14 days</div>
                </div>
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Cases Completed</span>
                    <div className="metric-card-icon"><CheckCircle2 size={16} /></div>
                  </div>
                  <div className="metric-card-value">{casesLoading ? '...' : casesSummary.completed}</div>
                  <div className="metric-card-footer">Disposed & archived</div>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="filter-toolbar-card">
                <div className="search-input-group">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-field"
                    placeholder="Search by case number, title, or client..."
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                  />
                </div>

                <div className="filter-controls-group">
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Status:</label>
                  <select
                    className="select-filter"
                    value={caseStatusFilter}
                    onChange={(e) => setCaseStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="PENDING_HEARING">Pending Hearing</option>
                    <option value="IN_TRIAL">In Trial</option>
                    <option value="CLOSED">Closed</option>
                    <option value="DISPOSED">Disposed</option>
                  </select>

                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Type:</label>
                  <select
                    className="select-filter"
                    value={caseTypeFilter}
                    onChange={(e) => setCaseTypeFilter(e.target.value)}
                  >
                    <option value="ALL">All Case Types</option>
                    <option value="CIVIL">Civil</option>
                    <option value="CRIMINAL">Criminal</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="FAMILY">Family</option>
                    <option value="TAXATION">Taxation</option>
                    <option value="ARBITRATION">Arbitration</option>
                  </select>

                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Deadline:</label>
                  <select
                    className="select-filter"
                    value={caseUrgencyFilter}
                    onChange={(e) => setCaseUrgencyFilter(e.target.value)}
                  >
                    <option value="ALL">All Deadlines</option>
                    <option value="DUE_SOON">Due Soon (14 Days)</option>
                    <option value="OVERDUE">Overdue</option>
                  </select>
                </div>
              </div>

              {/* Cases Display */}
              {casesLoading ? (
                <div className="loading-state-container">
                  <RefreshCw size={32} className="spinner-icon" />
                  <p>Loading authorized case files...</p>
                </div>
              ) : casesError ? (
                <div className="db-error-alert" role="alert">
                  <AlertTriangle size={24} className="db-error-icon" />
                  <div className="db-error-body">
                    <h4>Unable to Load Cases</h4>
                    <p>{casesError}</p>
                    <button type="button" className="btn-retry-conn" onClick={fetchCases}>
                      Try Again
                    </button>
                  </div>
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="data-table-container">
                  <div className="empty-state-box">
                    <Briefcase size={44} className="empty-state-icon" />
                    <h3 style={{ margin: '0 0 6px 0', color: '#172B4D', fontSize: '17px' }}>No Assigned Cases Found</h3>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B' }}>
                      {caseSearch || caseStatusFilter !== 'ALL' || caseTypeFilter !== 'ALL' || caseUrgencyFilter !== 'ALL'
                        ? 'No cases match your active filter criteria.'
                        : 'You currently have no cases assigned by supervising Advocates.'}
                    </p>
                  </div>
                </div>
              ) : casesViewMode === 'table' ? (
                /* Table View */
                <div className="data-table-container">
                  <div className="table-responsive">
                    <table className="legal-data-table">
                      <thead>
                        <tr>
                          <th>Case Number</th>
                          <th>Title & Matter</th>
                          <th>Type</th>
                          <th>Supervising Advocate</th>
                          <th>Client Name</th>
                          <th>Assigned Date</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th>Progress</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCases.map((c) => {
                          const urgency = getUrgency(c.deadline);
                          return (
                            <tr key={c.case_id}>
                              <td>
                                <span className="cell-code" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                  {c.case_number}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: '#172B4D', maxWidth: '240px' }}>
                                  {c.title}
                                </div>
                              </td>
                              <td>
                                <span className="badge-type">{c.case_type}</span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 500, color: '#1E293B' }}>{c.advocate_name}</div>
                                <span style={{ fontSize: '11px', color: '#64748B' }}>{c.advocate_email}</span>
                              </td>
                              <td>{c.client_name || '—'}</td>
                              <td>{formatDate(c.assigned_at)}</td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <span>{formatDate(c.deadline)}</span>
                                  {c.deadline && (
                                    <span className={`urgency-badge ${urgency.className}`} style={{ alignSelf: 'flex-start' }}>
                                      {urgency.label}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={`badge-status ${getStatusBadgeClass(c.case_status)}`}>
                                  {c.case_status.replace('_', ' ')}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '12px', color: '#172B4D', fontWeight: 600 }}>
                                  {c.pending_tasks_count} pending / {c.documents_count} docs
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn-primary-small"
                                  onClick={() => openCaseDetails(c.case_id)}
                                >
                                  <Eye size={14} />
                                  <span>View Details</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Cards Grid View */
                <div className="case-cards-grid">
                  {filteredCases.map((c) => {
                    const urgency = getUrgency(c.deadline);
                    return (
                      <div key={c.case_id} className="case-file-card">
                        <div className="case-card-header">
                          <div>
                            <span className="cell-code" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              {c.case_number}
                            </span>
                            <h3 className="case-card-title" style={{ marginTop: '4px' }}>{c.title}</h3>
                          </div>
                          <span className="badge-type">{c.case_type}</span>
                        </div>

                        <div className="case-card-meta-row">
                          <div className="case-meta-pair">
                            <span className="case-meta-label">Supervising Advocate</span>
                            <span style={{ fontWeight: 600, color: '#172B4D' }}>{c.advocate_name}</span>
                          </div>
                          <div className="case-meta-pair">
                            <span className="case-meta-label">Client</span>
                            <span>{c.client_name || '—'}</span>
                          </div>
                          <div className="case-meta-pair">
                            <span className="case-meta-label">Assigned Date</span>
                            <span>{formatDate(c.assigned_at)}</span>
                          </div>
                          <div className="case-meta-pair">
                            <span className="case-meta-label">Target Deadline</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: '#B99A5B' }}>{formatDate(c.deadline)}</span>
                              {c.deadline && (
                                <span className={`urgency-badge ${urgency.className}`}>{urgency.label}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="case-card-footer">
                          <span className={`badge-status ${getStatusBadgeClass(c.case_status)}`}>
                            {c.case_status.replace('_', ' ')}
                          </span>
                          <button
                            type="button"
                            className="btn-primary-small"
                            onClick={() => openCaseDetails(c.case_id)}
                          >
                            <Eye size={14} />
                            <span>View Details</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 2: CASE DOCUMENTS & DOCUMENTS ASSIGNED TO ME          */}
          {/* ========================================================== */}
          {(activeNav === 'documents' || activeNav === 'assigned_documents') && (
            <div>
              {/* Header */}
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>
                    {activeNav === 'assigned_documents' || docAssignmentFilter === 'ASSIGNED_TO_ME'
                      ? 'Documents Assigned to Me'
                      : 'All Case Documents'}
                  </h2>
                  <p>
                    {activeNav === 'assigned_documents' || docAssignmentFilter === 'ASSIGNED_TO_ME'
                      ? 'Confidential client documents and legal filings assigned directly to you for review and Grok AI analysis.'
                      : 'Access authorized documents across all case matters actively assigned to you.'}
                  </p>
                </div>
                <div className="page-header-actions">
                  {/* Segmented Filter Toggle: Assigned to Me vs All Authorized */}
                  <div className="view-toggle-group">
                    <button
                      type="button"
                      className={`view-toggle-btn ${docAssignmentFilter === 'ASSIGNED_TO_ME' ? 'active' : ''}`}
                      onClick={() => {
                        setDocAssignmentFilter('ASSIGNED_TO_ME');
                        setActiveNav('assigned_documents');
                      }}
                      title="Show documents explicitly assigned to you"
                    >
                      <UserCheck size={14} />
                      <span>Assigned to Me</span>
                    </button>
                    <button
                      type="button"
                      className={`view-toggle-btn ${docAssignmentFilter === 'ALL_AUTHORIZED' ? 'active' : ''}`}
                      onClick={() => {
                        setDocAssignmentFilter('ALL_AUTHORIZED');
                        setActiveNav('documents');
                      }}
                      title="Show all documents across your assigned cases"
                    >
                      <FolderOpen size={14} />
                      <span>All Case Files</span>
                    </button>
                  </div>

                  <div className="view-toggle-group">
                    <button
                      type="button"
                      className={`view-toggle-btn ${docViewMode === 'table' ? 'active' : ''}`}
                      onClick={() => setDocViewMode('table')}
                    >
                      <List size={15} />
                      <span>Table</span>
                    </button>
                    <button
                      type="button"
                      className={`view-toggle-btn ${docViewMode === 'cards' ? 'active' : ''}`}
                      onClick={() => setDocViewMode('cards')}
                    >
                      <Grid size={15} />
                      <span>Cards</span>
                    </button>
                  </div>
                  <button type="button" className="btn-secondary-action" onClick={fetchDocuments}>
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="metrics-grid-4">
                <div className="metric-card navy-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">
                      {docAssignmentFilter === 'ASSIGNED_TO_ME' ? 'Assigned to Me' : 'Authorized Documents'}
                    </span>
                    <div className="metric-card-icon"><FileText size={16} /></div>
                  </div>
                  <div className="metric-card-value">{documentsLoading ? '...' : docSummary.total}</div>
                  <div className="metric-card-footer">
                    {docAssignmentFilter === 'ASSIGNED_TO_ME' ? 'Directly assigned by clients' : 'Across your assigned matters'}
                  </div>
                </div>
                <div className="metric-card gold-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">AI Analyzed</span>
                    <div className="metric-card-icon"><Sparkles size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {documentsLoading ? '...' : documents.filter((d) => d.has_ai_summary || d.assignment_status === 'ANALYZED').length}
                  </div>
                  <div className="metric-card-footer">Grok AI briefs generated</div>
                </div>
                <div className="metric-card gold-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Pending Analysis</span>
                    <div className="metric-card-icon"><AlertCircle size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {documentsLoading ? '...' : documents.filter((d) => !d.has_ai_summary && d.assignment_status !== 'ANALYZED').length}
                  </div>
                  <div className="metric-card-footer">Awaiting legal summary</div>
                </div>
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Recent Filings</span>
                    <div className="metric-card-icon"><Clock size={16} /></div>
                  </div>
                  <div className="metric-card-value">{documentsLoading ? '...' : docSummary.recent}</div>
                  <div className="metric-card-footer">Received within 30 days</div>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="filter-toolbar-card">
                <div className="search-input-group">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-field"
                    placeholder="Search by title, file name, case number, or client..."
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                  />
                </div>

                <div className="filter-controls-group">
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Case:</label>
                  <select
                    className="select-filter"
                    value={docCaseFilter}
                    onChange={(e) => setDocCaseFilter(e.target.value)}
                  >
                    <option value="ALL">All Assigned Cases</option>
                    {cases.map((c) => (
                      <option key={c.case_id} value={c.case_id}>
                        {c.case_number} - {c.title.substring(0, 24)}...
                      </option>
                    ))}
                  </select>

                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Format:</label>
                  <select
                    className="select-filter"
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value)}
                  >
                    <option value="ALL">All Formats</option>
                    <option value="pdf">PDF Documents</option>
                    <option value="word">Word / DOCX</option>
                    <option value="text">Plain Text (.txt)</option>
                  </select>

                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Upload Date:</label>
                  <select
                    className="select-filter"
                    value={docDateFilter}
                    onChange={(e) => setDocDateFilter(e.target.value)}
                  >
                    <option value="ALL">All Dates</option>
                    <option value="7_DAYS">Last 7 Days</option>
                    <option value="30_DAYS">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Documents Display */}
              {documentsLoading ? (
                <div className="loading-state-container">
                  <RefreshCw size={32} className="spinner-icon" />
                  <p>Validating access clearances and loading authorized documents...</p>
                </div>
              ) : documentsError ? (
                <div className="db-error-alert" role="alert">
                  <AlertTriangle size={24} className="db-error-icon" />
                  <div className="db-error-body">
                    <h4>Error Loading Documents</h4>
                    <p>{documentsError}</p>
                    <button type="button" className="btn-retry-conn" onClick={fetchDocuments}>
                      Retry
                    </button>
                  </div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="data-table-container">
                  <div className="empty-state-box">
                    <FileText size={44} className="empty-state-icon" />
                    <h3 style={{ margin: '0 0 6px 0', color: '#172B4D', fontSize: '17px' }}>
                      {docAssignmentFilter === 'ASSIGNED_TO_ME'
                        ? 'No Documents Assigned to You'
                        : 'No Authorized Documents Found'}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B' }}>
                      {docSearch || docCaseFilter !== 'ALL' || docTypeFilter !== 'ALL'
                        ? 'No documents match your search filters.'
                        : docAssignmentFilter === 'ASSIGNED_TO_ME'
                        ? 'When clients upload documents and select you for analysis, they will appear here.'
                        : 'No documents have been uploaded to your assigned cases yet.'}
                    </p>
                  </div>
                </div>
              ) : docViewMode === 'table' ? (
                /* Table View */
                <div className="data-table-container">
                  <div className="table-responsive">
                    <table className="legal-data-table">
                      <thead>
                        <tr>
                          <th>Document Title & Format</th>
                          <th>Client Name</th>
                          <th>Related Case</th>
                          <th>Date Received</th>
                          <th>Assignment Status</th>
                          <th>AI Analysis</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocuments.map((doc) => {
                          const isPdf = (doc.mime_type || '').toLowerCase().includes('pdf') || doc.file_name.endsWith('.pdf');
                          const isAnalyzed = doc.assignment_status === 'ANALYZED' || doc.has_ai_summary;
                          return (
                            <tr key={doc.document_id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div className={`doc-type-icon-box ${isPdf ? 'pdf' : 'doc'}`} style={{ width: '32px', height: '32px' }}>
                                    <FileText size={16} />
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '13.5px' }}>
                                      {doc.document_title || doc.file_name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{doc.file_name}</span>
                                      <span className="badge-type" style={{ padding: '1px 5px', fontSize: '10px' }}>
                                        {isPdf ? 'PDF' : doc.file_name.endsWith('.docx') ? 'DOCX' : 'TXT'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: '#172B4D', fontSize: '13px' }}>
                                  {doc.client_name || 'Not Disclosed'}
                                </span>
                              </td>
                              <td>
                                <span className="cell-code" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>
                                  {doc.case_number}
                                </span>
                                <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {doc.case_title}
                                </div>
                              </td>
                              <td style={{ fontSize: '12.5px', color: '#64748B' }}>
                                {formatDate(doc.uploaded_at)}
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: isAnalyzed ? '#ECFDF5' : doc.assignment_status === 'IN_REVIEW' ? '#FFFBEB' : '#EFF6FF',
                                    color: isAnalyzed ? '#059669' : doc.assignment_status === 'IN_REVIEW' ? '#D97706' : '#2563EB',
                                    border: `1px solid ${isAnalyzed ? '#A7F3D0' : doc.assignment_status === 'IN_REVIEW' ? '#FDE68A' : '#BFDBFE'}`
                                  }}
                                >
                                  {doc.assignment_status || 'ASSIGNED'}
                                </span>
                              </td>
                              <td>
                                {doc.has_ai_summary ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: '#FAF6EF',
                                      color: '#B99A5B',
                                      border: '1px solid #E8DCC4',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 700
                                    }}
                                  >
                                    <Sparkles size={11} />
                                    <span>Brief Ready</span>
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                                    Pending Analysis
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleOpenDocumentPreview(doc)}
                                    title="View Document Preview"
                                  >
                                    <Eye size={13} />
                                    <span>View Document</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-accent btn-sm"
                                    onClick={() => openDocumentSummaryModal(doc)}
                                    title="Generate or Review Grok AI Legal Summary"
                                  >
                                    <Sparkles size={13} />
                                    <span>Generate AI Summary</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleDownloadDocument(doc.document_id, doc.file_name)}
                                    title="Secure Download"
                                  >
                                    <Download size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Cards View */
                <div className="doc-cards-grid">
                  {filteredDocuments.map((doc) => {
                    const isPdf = (doc.mime_type || '').toLowerCase().includes('pdf') || doc.file_name.endsWith('.pdf');
                    const isAnalyzed = doc.assignment_status === 'ANALYZED' || doc.has_ai_summary;
                    return (
                      <div key={doc.document_id} className="doc-file-card">
                        <div className="doc-card-top">
                          <div className={`doc-type-icon-box ${isPdf ? 'pdf' : 'doc'}`}>
                            <FileText size={20} />
                          </div>
                          <div className="doc-card-info" style={{ flex: 1, minWidth: 0 }}>
                            <h4 className="doc-card-filename" title={doc.document_title || doc.file_name}>
                              {doc.document_title || doc.file_name}
                            </h4>
                            <div className="doc-card-case">
                              Case: <strong>{doc.case_number}</strong>
                            </div>
                          </div>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '10px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: isAnalyzed ? '#ECFDF5' : '#EFF6FF',
                              color: isAnalyzed ? '#059669' : '#2563EB',
                              border: `1px solid ${isAnalyzed ? '#A7F3D0' : '#BFDBFE'}`
                            }}
                          >
                            {doc.assignment_status || 'ASSIGNED'}
                          </span>
                        </div>

                        <div className="case-meta-pair" style={{ fontSize: '12px' }}>
                          <span className="case-meta-label">Client Name</span>
                          <span style={{ fontWeight: 600, color: '#172B4D' }}>{doc.client_name || 'Not Disclosed'}</span>
                        </div>
                        <div className="case-meta-pair" style={{ fontSize: '12px' }}>
                          <span className="case-meta-label">Date Received</span>
                          <span>{formatDate(doc.uploaded_at)}</span>
                        </div>
                        <div className="case-meta-pair" style={{ fontSize: '12px' }}>
                          <span className="case-meta-label">AI Analysis</span>
                          <span>
                            {doc.has_ai_summary ? (
                              <strong style={{ color: '#059669' }}>Verified Summary Ready</strong>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>Pending Summary</span>
                            )}
                          </span>
                        </div>

                        <div className="case-card-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenDocumentPreview(doc)}
                            style={{ flex: 1 }}
                          >
                            <Eye size={12} />
                            <span>View Document</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-accent btn-sm"
                            onClick={() => openDocumentSummaryModal(doc)}
                            style={{ flex: 1.2 }}
                          >
                            <Sparkles size={12} />
                            <span>AI Summary</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleDownloadDocument(doc.document_id, doc.file_name)}
                            title="Download certified document"
                          >
                            <Download size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 3: RESEARCH TASKS (STAGE 6.1 REDESIGN)               */}
          {/* ========================================================== */}
          {activeNav === 'tasks' && (
            <div>
              {/* Header */}
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Research Tasks</h2>
                  <p>Track your delegated legal research, manage priorities, and submit your work on time.</p>
                </div>
                <div className="page-header-actions">
                  <div className="view-toggle-group">
                    <button
                      type="button"
                      className={`view-toggle-btn ${tasksViewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setTasksViewMode('list')}
                    >
                      <List size={15} />
                      <span>List View</span>
                    </button>
                    <button
                      type="button"
                      className={`view-toggle-btn ${tasksViewMode === 'board' ? 'active' : ''}`}
                      onClick={() => setTasksViewMode('board')}
                    >
                      <Layers size={15} />
                      <span>Board View</span>
                    </button>
                  </div>
                  <button type="button" className="btn-secondary-action" onClick={fetchTasks}>
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="metrics-grid-4">
                <div className="metric-card gold-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Pending Tasks</span>
                    <div className="metric-card-icon"><AlertCircle size={16} /></div>
                  </div>
                  <div className="metric-card-value">{tasksLoading ? '...' : tasksSummary.pending}</div>
                  <div className="metric-card-footer">Awaiting commencement</div>
                </div>
                <div className="metric-card navy-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">In Progress</span>
                    <div className="metric-card-icon"><Edit3 size={16} /></div>
                  </div>
                  <div className="metric-card-value">{tasksLoading ? '...' : tasksSummary.inProgress}</div>
                  <div className="metric-card-footer">Active drafting & citations</div>
                </div>
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Completed Tasks</span>
                    <div className="metric-card-icon"><CheckCircle2 size={16} /></div>
                  </div>
                  <div className="metric-card-value">{tasksLoading ? '...' : tasksSummary.completed}</div>
                  <div className="metric-card-footer">Archived with notes</div>
                </div>
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Overdue Tasks</span>
                    <div className="metric-card-icon" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                      <Clock size={16} />
                    </div>
                  </div>
                  <div className="metric-card-value" style={{ color: tasksSummary.overdue > 0 ? '#DC2626' : '#172B4D' }}>
                    {tasksLoading ? '...' : tasksSummary.overdue}
                  </div>
                  <div className="metric-card-footer">Requires immediate attention</div>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="filter-toolbar-card">
                <div className="search-input-group">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-field"
                    placeholder="Search tasks by title, instructions, or case..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                  />
                </div>

                <div className="filter-controls-group">
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Status:</label>
                  <select
                    className="select-filter"
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>

                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Priority:</label>
                  <select
                    className="select-filter"
                    value={taskPriorityFilter}
                    onChange={(e) => setTaskPriorityFilter(e.target.value)}
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>

                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Case:</label>
                  <select
                    className="select-filter"
                    value={taskCaseFilter}
                    onChange={(e) => setTaskCaseFilter(e.target.value)}
                  >
                    <option value="ALL">All Assigned Cases</option>
                    {cases.map((c) => (
                      <option key={c.case_id} value={c.case_id}>
                        {c.case_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tasks Content */}
              {tasksLoading ? (
                <div className="loading-state-container">
                  <RefreshCw size={32} className="spinner-icon" />
                  <p>Loading research tasks...</p>
                </div>
              ) : tasksError ? (
                <div className="db-error-alert" role="alert">
                  <AlertTriangle size={24} className="db-error-icon" />
                  <div className="db-error-body">
                    <h4>Error Loading Tasks</h4>
                    <p>{tasksError}</p>
                    <button type="button" className="btn-retry-conn" onClick={fetchTasks}>
                      Retry
                    </button>
                  </div>
                </div>
              ) : tasks.length === 0 ? (
                <div className="data-table-container">
                  <div className="empty-state-box">
                    <ClipboardList size={44} className="empty-state-icon" />
                    <h3 style={{ margin: '0 0 6px 0', color: '#172B4D', fontSize: '17px' }}>No Research Tasks Found</h3>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B' }}>
                      {taskSearch || taskStatusFilter !== 'ALL' || taskPriorityFilter !== 'ALL'
                        ? 'No research tasks match your search filters.'
                        : 'You do not have any active research tasks allocated by Advocates.'}
                    </p>
                  </div>
                </div>
              ) : tasksViewMode === 'list' ? (
                /* List View */
                <div className="data-table-container">
                  <div className="table-responsive">
                    <table className="legal-data-table">
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Case Reference</th>
                          <th>Priority</th>
                          <th>Due Date</th>
                          <th>Delegated By</th>
                          <th>Status & Submit to Advocate</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => {
                          const urgency = getUrgency(task.due_date);
                          return (
                            <tr key={task.task_id}>
                              <td>
                                <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '13.5px' }}>{task.title}</div>
                                {task.research_notes && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      color: '#059669',
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      marginTop: '3px'
                                    }}
                                  >
                                    <Check size={12} /> Notes Saved ({task.research_notes.length} chars)
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="cell-code" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {task.case_number}
                                </span>
                                <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {task.case_title}
                                </div>
                              </td>
                              <td>
                                <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                                  {task.priority}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <span>{formatDate(task.due_date)}</span>
                                  {task.status !== 'COMPLETED' && (
                                    <span className={`urgency-badge ${urgency.className}`} style={{ alignSelf: 'flex-start' }}>
                                      {urgency.label}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>{task.assigned_by_name}</td>
                              <td>
                                {(() => {
                                  const currentStatus = statusDrafts[task.task_id] || task.status;
                                  const isModified = Boolean(statusDrafts[task.task_id] && statusDrafts[task.task_id] !== task.status);
                                  const isCompleted = currentStatus === 'COMPLETED';
                                  const isSubmitting = submittingTaskId === task.task_id;

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <div className="status-btn-group">
                                          <button
                                            type="button"
                                            className={`status-toggle-btn ${currentStatus === 'PENDING' ? 'active pending' : ''}`}
                                            onClick={() => handleSelectRowStatus(task.task_id, 'PENDING')}
                                            title="Mark as Pending"
                                          >
                                            Pending
                                          </button>
                                          <button
                                            type="button"
                                            className={`status-toggle-btn ${currentStatus === 'IN_PROGRESS' ? 'active in-progress' : ''}`}
                                            onClick={() => handleSelectRowStatus(task.task_id, 'IN_PROGRESS')}
                                            title="Mark as In Progress"
                                          >
                                            In Progress
                                          </button>
                                          <button
                                            type="button"
                                            className={`status-toggle-btn ${currentStatus === 'COMPLETED' ? 'active completed' : ''}`}
                                            onClick={() => handleSelectRowStatus(task.task_id, 'COMPLETED')}
                                            title="Mark as Completed"
                                          >
                                            Completed
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          className={`btn-status-submit ${isModified ? 'status-has-changes' : ''} ${isCompleted && isModified ? 'submit-completed' : ''}`}
                                          onClick={() => handleRowStatusSubmit(task.task_id, currentStatus)}
                                          disabled={isSubmitting}
                                          title={isModified ? `Submit updated status "${currentStatus.replace('_', ' ')}" to Advocate` : "Submit this status to Advocate"}
                                        >
                                          {isSubmitting ? (
                                            <>
                                              <RefreshCw size={12} className="spinner-icon" />
                                              <span>Submitting...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Send size={12} />
                                              <span>{isModified ? 'Submit Status' : 'Submit'}</span>
                                            </>
                                          )}
                                        </button>
                                      </div>

                                      {task.status === 'COMPLETED' && !isModified && (
                                        <div className="status-sync-indicator">
                                          <CheckCircle2 size={12} />
                                          <span>Submitted to Advocate as Completed</span>
                                        </div>
                                      )}
                                      {isModified && (
                                        <div style={{ fontSize: '11px', color: '#B45309', fontWeight: 600 }}>
                                          * Click Submit to update Advocate on task status
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn-primary-small"
                                  onClick={() => openTaskModal(task)}
                                >
                                  <Edit3 size={13} />
                                  <span>Notes & Details</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Board (Kanban) View */
                <div className="kanban-board">
                  {/* Column 1: Pending */}
                  <div className="kanban-column">
                    <div className="kanban-column-header">
                      <h4>
                        <AlertCircle size={16} color="#B99A5B" />
                        <span>Pending</span>
                      </h4>
                      <span className="urgency-badge approaching">{kanbanColumns.pending.length}</span>
                    </div>
                    <div className="kanban-card-list">
                      {kanbanColumns.pending.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                          No pending tasks
                        </div>
                      ) : (
                        kanbanColumns.pending.map((task) => (
                          <div key={task.task_id} className="kanban-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className={`priority-badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
                              <span className="cell-code" style={{ fontSize: '11px' }}>{task.case_number}</span>
                            </div>
                            <h5 className="kanban-card-title">{task.title}</h5>
                            <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                              Due: <strong>{formatDate(task.due_date)}</strong>
                            </div>
                            <div className="kanban-card-actions">
                              <button
                                type="button"
                                className="btn-primary-small"
                                onClick={() => handleRowStatusSubmit(task.task_id, 'IN_PROGRESS')}
                                disabled={submittingTaskId === task.task_id}
                                title="Submit status as In Progress to Advocate"
                              >
                                {submittingTaskId === task.task_id ? <RefreshCw size={12} className="spinner-icon" /> : <Send size={12} />}
                                <span>Start & Submit</span>
                              </button>
                              <button
                                type="button"
                                className="btn-outline-small"
                                onClick={() => openTaskModal(task)}
                                title="Open notes & details"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Column 2: In Progress */}
                  <div className="kanban-column">
                    <div className="kanban-column-header">
                      <h4>
                        <Edit3 size={16} color="#172B4D" />
                        <span>In Progress</span>
                      </h4>
                      <span className="urgency-badge upcoming">{kanbanColumns.inProgress.length}</span>
                    </div>
                    <div className="kanban-card-list">
                      {kanbanColumns.inProgress.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                          No active research
                        </div>
                      ) : (
                        kanbanColumns.inProgress.map((task) => (
                          <div key={task.task_id} className="kanban-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className={`priority-badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
                              <span className="cell-code" style={{ fontSize: '11px' }}>{task.case_number}</span>
                            </div>
                            <h5 className="kanban-card-title">{task.title}</h5>
                            <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                              Due: <strong>{formatDate(task.due_date)}</strong>
                            </div>
                            {task.research_notes && (
                              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                                ✓ {task.research_notes.length} chars saved
                              </span>
                            )}
                            <div className="kanban-card-actions">
                              <button
                                type="button"
                                className="btn-primary-small"
                                style={{ background: '#059669', borderColor: '#059669' }}
                                onClick={() => handleRowStatusSubmit(task.task_id, 'COMPLETED')}
                                disabled={submittingTaskId === task.task_id}
                                title="Submit task as Completed to Advocate"
                              >
                                {submittingTaskId === task.task_id ? <RefreshCw size={12} className="spinner-icon" /> : <CheckCircle2 size={12} />}
                                <span>Submit Done</span>
                              </button>
                              <button
                                type="button"
                                className="btn-outline-small"
                                onClick={() => openTaskModal(task)}
                                title="Edit research notes & details"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn-outline-small"
                                onClick={() => handleRowStatusSubmit(task.task_id, 'PENDING')}
                                disabled={submittingTaskId === task.task_id}
                                title="Move back to Pending and submit"
                              >
                                Pending
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Column 3: Completed */}
                  <div className="kanban-column">
                    <div className="kanban-column-header">
                      <h4>
                        <CheckCircle2 size={16} color="#059669" />
                        <span>Completed</span>
                      </h4>
                      <span className="urgency-badge" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                        {kanbanColumns.completed.length}
                      </span>
                    </div>
                    <div className="kanban-card-list">
                      {kanbanColumns.completed.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                          No completed tasks yet
                        </div>
                      ) : (
                        kanbanColumns.completed.map((task) => (
                          <div key={task.task_id} className="kanban-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="urgency-badge" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                                COMPLETED
                              </span>
                              <span className="cell-code" style={{ fontSize: '11px' }}>{task.case_number}</span>
                            </div>
                            <h5 className="kanban-card-title">{task.title}</h5>
                            <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                              Finished on: {formatDate(task.updated_at || task.created_at)}
                            </div>
                            <div className="kanban-card-actions">
                              <button
                                type="button"
                                className="btn-outline-small"
                                onClick={() => openTaskModal(task)}
                              >
                                Inspect Record
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 4: HEARINGS & DEADLINES (STAGE 6.1 REDESIGN)          */}
          {/* ========================================================== */}
          {activeNav === 'deadlines' && (
            <div>
              {/* Header */}
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Hearings & Deadlines</h2>
                  <p>Stay prepared for upcoming court hearings and research deadlines.</p>
                </div>
                <div className="page-header-actions">
                  <div className="view-toggle-group">
                    <button
                      type="button"
                      className={`view-toggle-btn ${deadlinesViewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setDeadlinesViewMode('list')}
                    >
                      <List size={15} />
                      <span>Upcoming List</span>
                    </button>
                    <button
                      type="button"
                      className={`view-toggle-btn ${deadlinesViewMode === 'calendar' ? 'active' : ''}`}
                      onClick={() => setDeadlinesViewMode('calendar')}
                    >
                      <CalendarDays size={15} />
                      <span>Calendar View</span>
                    </button>
                  </div>
                  <button type="button" className="btn-secondary-action" onClick={fetchDeadlines}>
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="metrics-grid-4">
                <div className="metric-card gold-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Today's Events</span>
                    <div className="metric-card-icon"><Clock size={16} /></div>
                  </div>
                  <div className="metric-card-value">{deadlinesLoading ? '...' : deadlinesSummary.todayEvents}</div>
                  <div className="metric-card-footer">Scheduled for today</div>
                </div>
                <div className="metric-card navy-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Upcoming Hearings</span>
                    <div className="metric-card-icon"><Scale size={16} /></div>
                  </div>
                  <div className="metric-card-value">{deadlinesLoading ? '...' : deadlinesSummary.upcomingHearings}</div>
                  <div className="metric-card-footer">Cause list appearances</div>
                </div>
                <div className="metric-card navy-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Task Deadlines</span>
                    <div className="metric-card-icon"><ClipboardList size={16} /></div>
                  </div>
                  <div className="metric-card-value">{deadlinesLoading ? '...' : deadlinesSummary.upcomingTasks}</div>
                  <div className="metric-card-footer">Research due dates</div>
                </div>
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Overdue Items</span>
                    <div className="metric-card-icon" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                      <AlertTriangle size={16} />
                    </div>
                  </div>
                  <div className="metric-card-value" style={{ color: deadlinesSummary.overdueItems > 0 ? '#DC2626' : '#172B4D' }}>
                    {deadlinesLoading ? '...' : deadlinesSummary.overdueItems}
                  </div>
                  <div className="metric-card-footer">Past target schedule</div>
                </div>
              </div>

              {/* View 4A: Upcoming List View */}
              {deadlinesViewMode === 'list' && (
                <div>
                  {/* Filters */}
                  <div className="filter-toolbar-card">
                    <div className="filter-controls-group">
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Event Type:</label>
                      <select
                        className="select-filter"
                        value={deadlineTypeFilter}
                        onChange={(e) => setDeadlineTypeFilter(e.target.value)}
                      >
                        <option value="ALL">All Deadlines & Hearings</option>
                        <option value="HEARING">Court Hearings Only</option>
                        <option value="TASK">Research Tasks Only</option>
                      </select>

                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Timeframe:</label>
                      <select
                        className="select-filter"
                        value={deadlineTimeFilter}
                        onChange={(e) => setDeadlineTimeFilter(e.target.value)}
                      >
                        <option value="ALL">All Events (Chronological)</option>
                        <option value="OVERDUE">Overdue Only</option>
                        <option value="TODAY">Today Only</option>
                        <option value="THIS_WEEK">This Week</option>
                      </select>
                    </div>
                  </div>

                  {deadlinesLoading ? (
                    <div className="loading-state-container">
                      <RefreshCw size={32} className="spinner-icon" />
                      <p>Fetching scheduled court dates and deadlines...</p>
                    </div>
                  ) : deadlinesError ? (
                    <div className="db-error-alert" role="alert">
                      <AlertTriangle size={24} className="db-error-icon" />
                      <div className="db-error-body">
                        <h4>Error Loading Deadlines</h4>
                        <p>{deadlinesError}</p>
                        <button type="button" className="btn-retry-conn" onClick={fetchDeadlines}>
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : filteredDeadlines.length === 0 ? (
                    <div className="data-table-container">
                      <div className="empty-state-box">
                        <Calendar size={44} className="empty-state-icon" />
                        <h3 style={{ margin: '0 0 6px 0', color: '#172B4D', fontSize: '17px' }}>No Upcoming Deadlines</h3>
                        <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B' }}>
                          There are no scheduled court dates or pending task deadlines matching your criteria.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {filteredDeadlines.map((item, idx) => {
                        const urgency = getUrgency(item.deadline_date);
                        return (
                          <div key={idx} className="deadline-feed-item" style={{ padding: '18px' }}>
                            <div className={`deadline-icon-wrapper ${item.item_type === 'HEARING' ? 'hearing' : 'task'}`}>
                              {item.item_type === 'HEARING' ? <Scale size={22} /> : <Clock size={22} />}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <h4 style={{ margin: 0, fontSize: '15px', color: '#172B4D', fontWeight: 700 }}>
                                    {item.title}
                                  </h4>
                                  <span className={`badge-type ${item.item_type === 'HEARING' ? 'gold' : 'blue'}`}>
                                    {item.item_type}
                                  </span>
                                </div>
                                <span className={`urgency-badge ${urgency.className}`}>{urgency.label}</span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '10px', fontSize: '12.5px', color: '#475569' }}>
                                <div>
                                  Case: <strong style={{ color: '#172B4D' }}>{item.case_number}</strong> — {item.case_title}
                                </div>
                                <div>
                                  Location: <strong>{item.location}</strong> {item.judge_name && `• Judge ${item.judge_name}`}
                                </div>
                                <div>
                                  Advocate: <strong>{item.advocate_name}</strong>
                                </div>
                                <div>
                                  Target Schedule: <strong style={{ color: '#B99A5B' }}>{formatDateTime(item.deadline_date)}</strong>
                                </div>
                              </div>

                              {item.details && (
                                <p style={{ fontSize: '12.5px', color: '#64748B', margin: '8px 0 0 0', lineHeight: '1.5' }}>
                                  {item.details}
                                </p>
                              )}
                            </div>

                            {item.case_id && (
                              <button
                                type="button"
                                className="btn-outline-small"
                                onClick={() => openCaseDetails(item.case_id)}
                                style={{ alignSelf: 'center' }}
                              >
                                View File
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* View 4B: Interactive Calendar View */}
              {deadlinesViewMode === 'calendar' && (
                <div className="calendar-card">
                  <div className="calendar-top-bar">
                    <h3 className="calendar-month-title">
                      {currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="calendar-nav-buttons">
                      <button type="button" className="btn-outline-small" onClick={prevMonth}>
                        <ChevronLeft size={16} />
                      </button>
                      <button type="button" className="btn-secondary-action" onClick={goToToday} style={{ padding: '6px 12px' }}>
                        Today
                      </button>
                      <button type="button" className="btn-outline-small" onClick={nextMonth}>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="calendar-grid">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="calendar-weekday-cell">{day}</div>
                    ))}

                    {calendarDays.map((dayItem, idx) => {
                      const dayStr = dayItem.date.toISOString().split('T')[0];
                      const isToday = new Date().toISOString().split('T')[0] === dayStr;
                      const dayEvents = deadlines.filter((d) => d.deadline_date && d.deadline_date.startsWith(dayStr));

                      return (
                        <div
                          key={idx}
                          className={`calendar-day-cell ${!dayItem.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                          onClick={() => {
                            if (dayEvents.length > 0) {
                              setSelectedCalendarDayEvents({ date: dayItem.date, events: dayEvents });
                            }
                          }}
                        >
                          <span className="calendar-day-number">{dayItem.dayNumber}</span>
                          {dayEvents.slice(0, 3).map((ev, evIdx) => (
                            <div
                              key={evIdx}
                              className={`calendar-event-pill ${ev.item_type === 'HEARING' ? 'hearing' : 'task'}`}
                              title={`${ev.title} (${ev.case_number})`}
                            >
                              <span>{ev.item_type === 'HEARING' ? '⚖️' : '📋'}</span>
                              <span>{ev.title}</span>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>
                              +{dayEvents.length - 3} more
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="calendar-legend">
                    <div className="calendar-legend-item">
                      <span className="calendar-legend-dot hearing" />
                      <span>Court Hearings</span>
                    </div>
                    <div className="calendar-legend-item">
                      <span className="calendar-legend-dot task" />
                      <span>Research Tasks & Filing Deadlines</span>
                    </div>
                  </div>

                  {/* Selected Day Event Drawer */}
                  {selectedCalendarDayEvents && (
                    <div style={{ marginTop: '24px', padding: '18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#172B4D' }}>
                          Scheduled Events for {selectedCalendarDayEvents.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setSelectedCalendarDayEvents(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedCalendarDayEvents.events.map((ev, idx) => (
                          <div key={idx} style={{ padding: '10px 12px', backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '13px', color: '#172B4D' }}>{ev.title}</strong>
                              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                                Case {ev.case_number} • Time: {formatDateTime(ev.deadline_date)} • {ev.location}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn-primary-small"
                              onClick={() => openCaseDetails(ev.case_id)}
                            >
                              View Dossier
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 5: COMPLETED WORK (STAGE 6.1 REDESIGN)                */}
          {/* ========================================================== */}
          {activeNav === 'completed' && (
            <div>
              {/* Header */}
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Completed Work</h2>
                  <p>Review your completed research tasks, submitted results, and past assignments.</p>
                </div>
                <div className="page-header-actions">
                  <button type="button" className="btn-secondary-action" onClick={fetchTasks}>
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="metrics-grid-4">
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Completed Tasks</span>
                    <div className="metric-card-icon" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                  <div className="metric-card-value">{completedSummary.total}</div>
                  <div className="metric-card-footer">Permanently saved on ledger</div>
                </div>
                <div className="metric-card gold-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Completed This Month</span>
                    <div className="metric-card-icon"><Calendar size={16} /></div>
                  </div>
                  <div className="metric-card-value">{completedSummary.thisMonth}</div>
                  <div className="metric-card-footer">Current calendar month</div>
                </div>
                <div className="metric-card navy-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Research Results</span>
                    <div className="metric-card-icon"><FileText size={16} /></div>
                  </div>
                  <div className="metric-card-value">{completedSummary.notesSubmitted}</div>
                  <div className="metric-card-footer">Tasks with citations & notes</div>
                </div>
                <div className="metric-card gold-accent">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Completed On Time</span>
                    <div className="metric-card-icon"><Award size={16} /></div>
                  </div>
                  <div className="metric-card-value">{completedSummary.onTime}</div>
                  <div className="metric-card-footer">Met advocate deadlines</div>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="filter-toolbar-card">
                <div className="search-input-group">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-field"
                    placeholder="Search by task title, case number, or keywords in notes..."
                    value={completedSearch}
                    onChange={(e) => setCompletedSearch(e.target.value)}
                  />
                </div>

                <div className="filter-controls-group">
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Case:</label>
                  <select
                    className="select-filter"
                    value={completedCaseFilter}
                    onChange={(e) => setCompletedCaseFilter(e.target.value)}
                  >
                    <option value="ALL">All Assigned Cases</option>
                    {cases.map((c) => (
                      <option key={c.case_id} value={c.case_id}>
                        {c.case_number} - {c.title.substring(0, 24)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Completed Tasks Table */}
              <div className="data-table-container">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
                    Finished Research Tasks & Memoranda
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Showing {filteredCompletedTasks.length} archived record(s)
                  </span>
                </div>

                {filteredCompletedTasks.length === 0 ? (
                  <div className="empty-state-box">
                    <CheckCircle2 size={44} className="empty-state-icon" />
                    <h3 style={{ margin: '0 0 6px 0', color: '#172B4D', fontSize: '17px' }}>No Completed Tasks Found</h3>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B' }}>
                      {completedSearch || completedCaseFilter !== 'ALL'
                        ? 'No completed tasks match your search query.'
                        : 'Completed research briefs will be archived here once finalized.'}
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="legal-data-table">
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Case Reference</th>
                          <th>Assigned Advocate</th>
                          <th>Completion Date</th>
                          <th>Original Due Date</th>
                          <th>Submitted Research Notes</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompletedTasks.map((t) => (
                          <tr key={t.task_id}>
                            <td>
                              <span style={{ fontWeight: 600, color: '#172B4D' }}>{t.title}</span>
                            </td>
                            <td>
                              <span className="cell-code" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {t.case_number}
                              </span>
                              <div style={{ fontSize: '11px', color: '#64748B' }}>{t.case_title}</div>
                            </td>
                            <td>{t.assigned_by_name}</td>
                            <td>{formatDate(t.updated_at || t.created_at)}</td>
                            <td>{formatDate(t.due_date)}</td>
                            <td>
                              <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: '#475569' }}>
                                {t.research_notes ? `"${t.research_notes}"` : 'No notes attached'}
                              </div>
                            </td>
                            <td>
                              <span className="urgency-badge" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                                COMPLETED
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn-primary-small"
                                onClick={() => setSelectedCompletedDossier(t)}
                              >
                                <Eye size={13} />
                                <span>View Dossier</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Disposed & Closed Matters Section */}
              <div className="data-table-container" style={{ marginTop: '28px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
                    Disposed & Closed Legal Matters
                  </h3>
                </div>
                {closedCasesList.length === 0 ? (
                  <div className="empty-state-box">
                    <Briefcase size={36} className="empty-state-icon" />
                    <p style={{ margin: 0, fontSize: '13px' }}>No disposed or closed matters in your history.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="legal-data-table">
                      <thead>
                        <tr>
                          <th>Case Number</th>
                          <th>Case Title</th>
                          <th>Type</th>
                          <th>Supervising Advocate</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedCasesList.map((c) => (
                          <tr key={c.case_id}>
                            <td className="cell-code" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              {c.case_number}
                            </td>
                            <td style={{ fontWeight: 600, color: '#172B4D' }}>{c.title}</td>
                            <td><span className="badge-type">{c.case_type}</span></td>
                            <td>{c.advocate_name}</td>
                            <td>
                              <span className={`badge-status ${getStatusBadgeClass(c.case_status)}`}>
                                {c.case_status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn-outline-small"
                                onClick={() => openCaseDetails(c.case_id)}
                              >
                                View Case Record
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 6: MY PROFILE                                         */}
          {/* ========================================================== */}
          {activeNav === 'profile' && (
            <div>
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Staff Profile & Credentials</h2>
                  <p>View your operational clearance, employee credentials, and account details.</p>
                </div>
              </div>

              <div className="staff-profile-card">
                <div className="staff-profile-header">
                  <div className="staff-profile-avatar-large">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#172B4D', fontFamily: 'var(--font-serif, "Cinzel", serif)' }}>
                      {user?.full_name || 'Staff Member'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="profile-badge-tag">Verified Legal Assistant / Staff</span>
                      <span className="urgency-badge upcoming">ACTIVE CLEARANCE</span>
                    </div>
                  </div>
                </div>

                <div className="staff-profile-meta-list">
                  <div className="staff-meta-item">
                    <span className="staff-meta-label">Email Address</span>
                    <span className="staff-meta-value">{user?.email || '—'}</span>
                  </div>
                  <div className="staff-meta-item">
                    <span className="staff-meta-label">Employee Code</span>
                    <span className="staff-meta-value">{overviewData?.staff_profile?.employee_code || 'EMP-STAFF'}</span>
                  </div>
                  <div className="staff-meta-item">
                    <span className="staff-meta-label">Assigned Workload</span>
                    <span className="staff-meta-value">
                      {overviewData?.metrics?.assigned_cases ?? 0} Matters • {overviewData?.metrics?.pending_tasks ?? 0} Pending Tasks
                    </span>
                  </div>
                  <div className="staff-meta-item">
                    <span className="staff-meta-label">Security Protocol</span>
                    <span className="staff-meta-value">Encrypted Session • Role-Based Clearance</span>
                  </div>
                </div>

                <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Verified Security Clearance Session
                  </div>
                  <button
                    type="button"
                    className="btn-topbar-signout"
                    onClick={() => setShowLogoutConfirm(true)}
                  >
                    <LogOut size={14} />
                    <span>Terminate Session</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* CASE FILE DETAILS MODAL                                      */}
      {/* ------------------------------------------------------------ */}
      {showCaseModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-large">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {selectedCase ? selectedCase.title : 'Case File Details'}
                </h3>
                <span className="modal-subtitle">
                  Case Number: {selectedCase?.case_number} • Clearance: Assigned Staff Member
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCaseModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-tabs">
              <button
                type="button"
                className={`modal-tab-btn ${caseModalTab === 'info' ? 'active' : ''}`}
                onClick={() => setCaseModalTab('info')}
              >
                Overview & Instructions
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${caseModalTab === 'client' ? 'active' : ''}`}
                onClick={() => setCaseModalTab('client')}
              >
                Client Information
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${caseModalTab === 'documents' ? 'active' : ''}`}
                onClick={() => setCaseModalTab('documents')}
              >
                Documents ({selectedCase?.documents?.length || 0})
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${caseModalTab === 'hearings' ? 'active' : ''}`}
                onClick={() => setCaseModalTab('hearings')}
              >
                Hearings ({selectedCase?.hearings?.length || 0})
              </button>
            </div>

            <div className="modal-body">
              {caseModalLoading ? (
                <div className="loading-state-container">
                  <RefreshCw size={28} className="spinner-icon" />
                  <p>Loading authorized case file data...</p>
                </div>
              ) : selectedCase ? (
                <>
                  {caseModalTab === 'info' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <label>Case Status</label>
                          <span className={`badge-status ${getStatusBadgeClass(selectedCase.case_status)}`}>
                            {selectedCase.case_status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="detail-item">
                          <label>Case Type</label>
                          <span className="badge-tag">{selectedCase.case_type}</span>
                        </div>
                        <div className="detail-item">
                          <label>Supervising Advocate</label>
                          <div style={{ fontWeight: 600, color: '#172B4D' }}>
                            {selectedCase.advocate?.full_name}
                          </div>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>
                            {selectedCase.advocate?.email}
                          </span>
                        </div>
                        <div className="detail-item">
                          <label>Assignment Deadline</label>
                          <span style={{ fontWeight: 600, color: '#B99A5B' }}>
                            {formatDate(selectedCase.assignment?.deadline)}
                          </span>
                        </div>
                      </div>

                      <div className="detail-item">
                        <label>Assignment Instructions from Advocate</label>
                        <div
                          style={{
                            background: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            color: '#92400E',
                            fontSize: '13.5px',
                            lineHeight: '1.6'
                          }}
                        >
                          {selectedCase.assignment?.instructions || 'No specific assignment instructions provided.'}
                        </div>
                      </div>

                      {selectedCase.description && (
                        <div className="detail-item">
                          <label>Case Brief & Factual Summary</label>
                          <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                            {selectedCase.description}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {caseModalTab === 'client' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                        Relevant client contact information required for coordination and service of process.
                      </p>

                      {selectedCase.clients?.length === 0 ? (
                        <div className="empty-state-box">
                          <User size={32} />
                          <p>No client details recorded for this case file.</p>
                        </div>
                      ) : (
                        selectedCase.clients.map((client) => (
                          <div key={client.client_id} className="client-detail-card">
                            <h4 style={{ margin: 0, color: '#172B4D', fontSize: '15px' }}>{client.full_name}</h4>
                            <div className="client-detail-row">
                              <Mail size={15} />
                              <span>{client.email || 'No email on record'}</span>
                            </div>
                            <div className="client-detail-row">
                              <Phone size={15} />
                              <span>{client.phone}</span>
                            </div>
                            <div className="client-detail-row">
                              <MapPin size={15} />
                              <span>{client.address}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {caseModalTab === 'documents' && (
                    <div>
                      {selectedCase.documents?.length === 0 ? (
                        <div className="empty-state-box">
                          <FileText size={32} />
                          <p>No documents associated with this case.</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="legal-data-table">
                            <thead>
                              <tr>
                                <th>File Name</th>
                                <th>Type</th>
                                <th>Uploaded Date</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedCase.documents.map((doc) => (
                                <tr key={doc.document_id}>
                                  <td style={{ fontWeight: 600, color: '#172B4D' }}>{doc.file_name}</td>
                                  <td><span className="badge-tag">{doc.mime_type}</span></td>
                                  <td>{formatDate(doc.uploaded_at)}</td>
                                  <td>
                                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                                      <button
                                        type="button"
                                        className="btn btn-accent btn-sm"
                                        onClick={() => {
                                          openDocumentSummaryModal({
                                            ...doc,
                                            case_id: selectedCase.case_id,
                                            case_number: selectedCase.case_number,
                                            case_title: selectedCase.title
                                          });
                                        }}
                                        title="Generate or Review Grok AI Summary"
                                      >
                                        <Sparkles size={13} />
                                        <span>AI Summary</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleDownloadDocument(doc.document_id, doc.file_name)}
                                        title="Download"
                                      >
                                        <Download size={13} />
                                        <span>Download</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {caseModalTab === 'hearings' && (
                    <div>
                      {selectedCase.hearings?.length === 0 ? (
                        <div className="empty-state-box">
                          <Calendar size={32} />
                          <p>No court hearings scheduled for this case.</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="legal-data-table">
                            <thead>
                              <tr>
                                <th>Court Date</th>
                                <th>Courtroom / Bench</th>
                                <th>Judge</th>
                                <th>Status</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedCase.hearings.map((h) => (
                                <tr key={h.hearing_id}>
                                  <td style={{ fontWeight: 600 }}>{formatDateTime(h.hearing_date)}</td>
                                  <td>{h.court_name}</td>
                                  <td>{h.judge_name || 'Designated Bench'}</td>
                                  <td>
                                    <span className={`badge-status ${h.hearing_status === 'SCHEDULED' ? 'badge-status-trial' : 'badge-status-closed'}`}>
                                      {h.hearing_status}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                                      {h.notes || 'No procedural notes recorded'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCaseModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* RESEARCH TASK DETAILS & NOTES MODAL                         */}
      {/* ------------------------------------------------------------ */}
      {showTaskModal && selectedTask && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-large">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedTask.title}</h3>
                <span className="modal-subtitle">
                  Case: {selectedTask.case_number} • Delegated by: {selectedTask.assigned_by_name}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTaskModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTaskDetails}>
              <div className="modal-body">
                {modalTaskError && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#DC2626',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '14px'
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>{modalTaskError}</span>
                  </div>
                )}

                {/* Task Instructions from Advocate */}
                <div className="detail-item">
                  <label>Advocate Instructions & Research Scope</label>
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      fontSize: '13.5px',
                      color: '#334155',
                      lineHeight: '1.6'
                    }}
                  >
                    {selectedTask.instructions || 'No detailed instructions provided.'}
                  </div>
                </div>

                {/* Priority & Due Date Meta */}
                <div className="detail-grid" style={{ marginTop: '14px' }}>
                  <div className="detail-item">
                    <label>Task Priority</label>
                    <span className={`priority-badge ${selectedTask.priority?.toLowerCase()}`}>
                      {selectedTask.priority}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Target Due Date</label>
                    <span style={{ fontWeight: 600, color: '#B99A5B' }}>
                      {formatDate(selectedTask.due_date)}
                    </span>
                  </div>
                </div>

                {/* Update Task Status */}
                <div className="detail-item" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>Task Progression Status</label>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                      Current: <strong style={{ color: selectedTask.status === 'COMPLETED' ? '#059669' : selectedTask.status === 'IN_PROGRESS' ? '#1D4ED8' : '#B45309' }}>{selectedTask.status.replace('_', ' ')}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div className="status-btn-group" style={{ flex: 1, minWidth: '280px' }}>
                      <button
                        type="button"
                        style={{ flex: 1, justifyContent: 'center' }}
                        className={`status-toggle-btn ${taskStatusInput === 'PENDING' ? 'active pending' : ''}`}
                        onClick={() => setTaskStatusInput('PENDING')}
                      >
                        Pending Action
                      </button>
                      <button
                        type="button"
                        style={{ flex: 1, justifyContent: 'center' }}
                        className={`status-toggle-btn ${taskStatusInput === 'IN_PROGRESS' ? 'active in-progress' : ''}`}
                        onClick={() => setTaskStatusInput('IN_PROGRESS')}
                      >
                        In Progress
                      </button>
                      <button
                        type="button"
                        style={{ flex: 1, justifyContent: 'center' }}
                        className={`status-toggle-btn ${taskStatusInput === 'COMPLETED' ? 'active completed' : ''}`}
                        onClick={() => setTaskStatusInput('COMPLETED')}
                      >
                        Completed
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`btn-status-submit ${taskStatusInput !== selectedTask.status ? 'status-has-changes' : ''} ${taskStatusInput === 'COMPLETED' ? 'submit-completed' : ''}`}
                      onClick={() => handleSaveTaskDetails()}
                      disabled={savingTask}
                      title="Submit selected status and notes directly to Advocate"
                      style={{ padding: '8px 16px', fontSize: '12.5px', height: '38px' }}
                    >
                      {savingTask ? (
                        <>
                          <RefreshCw size={13} className="spinner-icon" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Submit Status</span>
                        </>
                      )}
                    </button>
                  </div>
                  {taskStatusInput === 'COMPLETED' && (
                    <div className="status-sync-indicator" style={{ marginTop: '6px' }}>
                      <CheckCircle2 size={12} />
                      <span>Ready to submit to supervising Advocate as Completed</span>
                    </div>
                  )}
                  {taskStatusInput !== selectedTask.status && (
                    <div style={{ fontSize: '11px', color: '#B45309', fontWeight: 600, marginTop: '4px' }}>
                      * Status changed to {taskStatusInput.replace('_', ' ')} — click "Submit Status" or the button below to update Advocate
                    </div>
                  )}
                </div>

                {/* Research Notes & Work Results Editor */}
                <div className="notes-editor-box">
                  <label htmlFor="task-notes-editor" style={{ fontWeight: 600, color: '#172B4D', fontSize: '13.5px' }}>
                    Research Notes & Case Precedents (Work Results)
                  </label>
                  <p style={{ fontSize: '12.5px', color: '#64748B', margin: '0 0 6px 0' }}>
                    Record relevant judgments, Supreme Court / High Court citations, statutory provisions,
                    affidavit verification summaries, and investigative findings.
                  </p>
                  <textarea
                    id="task-notes-editor"
                    className="notes-textarea"
                    placeholder="Enter case citations, analytical findings, or draft verification notes here..."
                    value={taskNotesInput}
                    onChange={(e) => setTaskNotesInput(e.target.value)}
                    rows={6}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94A3B8' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <ShieldCheck size={13} color="#059669" />
                      Persistent storage in certified legal archive
                    </span>
                    <span>{taskNotesInput.length} characters</span>
                  </div>

                  {/* Inline Submit Action Bar in Research Notes */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '12px',
                      padding: '12px 14px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Send size={14} color="#B99A5B" />
                        <span>Submit Work & Status to Advocate</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                        Updates task status to <strong>{taskStatusInput.replace('_', ' ')}</strong> and syncs notes to the Advocate portal.
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={savingTask}
                      style={{ padding: '8px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {savingTask ? (
                        <>
                          <RefreshCw size={14} className="spinner-icon" />
                          <span>Submitting to Advocate...</span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Submit Work to Advocate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowTaskModal(false)}
                  disabled={savingTask}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingTask}>
                  {savingTask ? (
                    <>
                      <RefreshCw size={15} className="spinner-icon" />
                      <span>Submitting to Advocate...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Submit Status & Notes to Advocate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TASK COMPLETION REVIEW CONFIRMATION MODAL                    */}
      {/* ------------------------------------------------------------ */}
      {showCompletionConfirm && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-small">
            <div className="modal-header">
              <h3 className="modal-title">Confirm Work Submission to Advocate</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCompletionConfirm(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.5', margin: 0 }}>
                You are about to mark <strong>{selectedTask?.title}</strong> as <strong>Completed</strong>.
              </p>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px 12px', marginTop: '12px', fontSize: '12.5px', color: '#64748B' }}>
                <strong>Research Notes Saved:</strong> {taskNotesInput.length > 0 ? `${taskNotesInput.length} characters entered` : 'No research notes entered.'}
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '10px' }}>
                Supervising Advocates will immediately see this task as Completed on their dashboard.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCompletionConfirm(false)}
              >
                Back to Edit
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={executeSaveTask}
                disabled={savingTask}
              >
                {savingTask ? (
                  <>
                    <RefreshCw size={14} className="spinner-icon" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Confirm & Submit to Advocate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* COMPLETED WORK DOSSIER INSPECTION MODAL                      */}
      {/* ------------------------------------------------------------ */}
      {selectedCompletedDossier && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-large">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedCompletedDossier.title}</h3>
                <span className="modal-subtitle">
                  Completed Research Dossier • Case: {selectedCompletedDossier.case_number}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedCompletedDossier(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Associated Case</label>
                  <span style={{ fontWeight: 600, color: '#172B4D' }}>{selectedCompletedDossier.case_number}</span>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>{selectedCompletedDossier.case_title}</div>
                </div>
                <div className="detail-item">
                  <label>Delegating Advocate</label>
                  <span style={{ fontWeight: 600, color: '#172B4D' }}>{selectedCompletedDossier.assigned_by_name}</span>
                </div>
                <div className="detail-item">
                  <label>Completion Date</label>
                  <span style={{ fontWeight: 600, color: '#059669' }}>
                    {formatDate(selectedCompletedDossier.updated_at || selectedCompletedDossier.created_at)}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Original Target</label>
                  <span style={{ fontWeight: 600, color: '#B99A5B' }}>
                    {formatDate(selectedCompletedDossier.due_date)}
                  </span>
                </div>
              </div>

              <div className="detail-item">
                <label>Original Instructions & Scope</label>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#334155' }}>
                  {selectedCompletedDossier.instructions || 'No special instructions recorded.'}
                </div>
              </div>

              <div className="detail-item">
                <label>Submitted Research Notes, Precedents & Work Results</label>
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '16px', fontSize: '13.5px', color: '#172B4D', whiteSpace: 'pre-wrap', lineHeight: '1.6', minHeight: '120px' }}>
                  {selectedCompletedDossier.research_notes || 'No extended notes were entered for this task.'}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedCompletedDossier(null)}
              >
                Close
              </button>
              {selectedCompletedDossier.case_id && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const cid = selectedCompletedDossier.case_id;
                    setSelectedCompletedDossier(null);
                    openCaseDetails(cid);
                  }}
                >
                  <Briefcase size={14} />
                  <span>Open Full Case File</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* LOGOUT CONFIRMATION MODAL                                    */}
      {/* ------------------------------------------------------------ */}
      {showLogoutConfirm && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-small">
            <div className="modal-header">
              <h3 className="modal-title">Confirm Sign Out</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to end your active staff coordination session? Any unsaved note
                drafts will be lost.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={logout}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* DOCUMENT PREVIEW MODAL (CLIENT ASSIGNED & CASE FILES)        */}
      {/* ------------------------------------------------------------ */}
      {showPreviewModal && previewDoc && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-large" style={{ maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ borderBottom: '1px solid #E5E9F0', padding: '18px 24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#172B4D', color: '#FFFFFF', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                    <Eye size={12} />
                    <span>DOCUMENT PREVIEW</span>
                  </span>
                  <span className="badge-type">{previewDoc.mime_type || 'DOCUMENT'}</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: previewDoc.assignment_status === 'ANALYZED' ? '#ECFDF5' : '#EFF6FF',
                      color: previewDoc.assignment_status === 'ANALYZED' ? '#059669' : '#2563EB',
                      border: `1px solid ${previewDoc.assignment_status === 'ANALYZED' ? '#A7F3D0' : '#BFDBFE'}`
                    }}
                  >
                    {previewDoc.assignment_status || 'ASSIGNED'}
                  </span>
                </div>
                <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '4px 0 2px' }}>
                  {previewDoc.document_title || previewDoc.file_name}
                </h3>
                <span className="modal-subtitle" style={{ fontSize: '12.5px', color: '#64748B' }}>
                  Case: <strong>{previewDoc.case_number}</strong> • {previewDoc.case_title}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDownloadDocument(previewDoc.document_id, previewDoc.file_name)}
                  title="Download Original File"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewDoc(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {/* Confidentiality banner */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={18} style={{ color: '#059669' }} />
                  <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500 }}>
                    Privileged Client Document • Assigned to You for Case Analysis
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Uploaded by: <strong>{previewDoc.uploaded_by_name || 'Client'}</strong> • {formatDate(previewDoc.uploaded_at)}
                </div>
              </div>

              {previewDoc.description && (
                <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '3px' }}>
                    Client Instructions / Description
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#78350F', lineHeight: 1.5 }}>
                    {previewDoc.description}
                  </p>
                </div>
              )}

              {previewLoading ? (
                <div className="loading-state-container" style={{ padding: '40px' }}>
                  <RefreshCw size={26} className="btn-spinner" />
                  <p>Loading document content preview securely...</p>
                </div>
              ) : previewError ? (
                <div className="feedback-banner error" role="alert" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Preview Error:</strong> {previewError}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Extracted Text Content Snippet
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                      {previewDoc.size_bytes ? `${Math.round(previewDoc.size_bytes / 1024)} KB` : ''}
                    </span>
                  </div>

                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '18px 20px',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '12.5px',
                      lineHeight: 1.6,
                      color: '#1E293B',
                      maxHeight: '380px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    {previewDoc.preview_text || 'No text content available for preview. Please download the original file.'}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ borderTop: '1px solid #E5E9F0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewDoc(null);
                }}
              >
                Close Preview
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={() => {
                    const docToSummarize = { ...previewDoc };
                    setShowPreviewModal(false);
                    openDocumentSummaryModal(docToSummarize);
                  }}
                  title="Generate Grok AI Legal Brief from this document"
                >
                  <Sparkles size={14} />
                  <span>Generate AI Summary</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleDownloadDocument(previewDoc.document_id, previewDoc.file_name)}
                >
                  <Download size={14} />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* GROK AI DOCUMENT SUMMARY MODAL                               */}
      {/* ------------------------------------------------------------ */}
      {showSummaryModal && summaryDoc && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-large" style={{ maxWidth: '960px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ borderBottom: '1px solid #E5E9F0', padding: '20px 24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, #B99A5B 0%, #A48545 100%)', color: '#FFFFFF', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                    <Sparkles size={12} />
                    <span>GROK AI LEGAL BRIEF</span>
                  </span>
                  <span className="badge-type">{summaryDoc.mime_type || 'DOCUMENT'}</span>
                </div>
                <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '4px 0 2px' }}>
                  {summaryDoc.file_name}
                </h3>
                <span className="modal-subtitle" style={{ fontSize: '12.5px', color: '#64748B' }}>
                  Case: <strong>{summaryDoc.case_number}</strong> • Uploaded {formatDate(summaryDoc.uploaded_at)} by {summaryDoc.uploaded_by_name || 'Authorized Litigant'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownloadDocument(summaryDoc.document_id, summaryDoc.file_name)}
                  title="Download Original Document to Compare"
                >
                  <Download size={13} />
                  <span>Original File</span>
                </button>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => {
                    setShowSummaryModal(false);
                    setSummaryDoc(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {/* Error Alert if any */}
              {summaryError && (
                <div className="feedback-banner error" role="alert" style={{ marginBottom: '20px' }}>
                  <AlertTriangle size={18} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: '2px' }}>AI Analysis Error</strong>
                    <span>{summaryError}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleGenerateSummary(true)}
                  >
                    <RotateCcw size={12} />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {/* Loading state while generating */}
              {summaryGenerating ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', background: '#FAFCFE', borderRadius: '12px', border: '1px solid #E5E9F0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #172B4D 0%, #0F1D33 100%)', color: '#B99A5B', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 14px rgba(23,43,77,0.2)' }}>
                    <Sparkles size={28} className="btn-spinner" />
                  </div>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '0 0 8px' }}>
                    Analyzing Legal Document with Grok AI
                  </h4>
                  <p style={{ fontSize: '13.5px', color: '#64748B', maxWidth: '520px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                    Extracting document clauses, identifying parties, isolating key dates, evaluating legal obligations, and framing questions for supervising advocate review...
                  </p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#FFFFFF', borderRadius: '20px', border: '1px solid #B99A5B', fontSize: '12px', color: '#B99A5B', fontWeight: 600 }}>
                    <ShieldCheck size={14} />
                    <span>Legal AI Synthesis • Document Defense Active</span>
                  </div>
                </div>
              ) : summaryLoading ? (
                <div className="loading-state-container" style={{ padding: '40px' }}>
                  <RefreshCw size={28} className="btn-spinner" />
                  <p>Checking records for verified summary...</p>
                </div>
              ) : summaryData ? (
                /* Summary Display */
                <div>
                  {/* Top Bar inside modal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #E5E9F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge-status open" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 size={12} />
                        <span>Verified Summary Stored</span>
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        Model: <strong>{currentPreference?.model || summaryData.model || 'qwen/qwen3.8-27b'}</strong>
                      </span>
                      {summaryData.updated_at && (
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          • Generated: {formatDate(summaryData.updated_at)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* View toggle */}
                      <div className="view-toggle-group">
                        <button
                          type="button"
                          className={`view-toggle-btn ${summaryViewMode === 'sections' ? 'active' : ''}`}
                          onClick={() => setSummaryViewMode('sections')}
                        >
                          <span>Structured Sections</span>
                        </button>
                        <button
                          type="button"
                          className={`view-toggle-btn ${summaryViewMode === 'full' ? 'active' : ''}`}
                          onClick={() => setSummaryViewMode('full')}
                        >
                          <span>Full Brief</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleCopySummary}
                        title="Copy complete legal summary to clipboard"
                      >
                        {copiedSummary ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                        <span>{copiedSummary ? 'Copied Brief!' : 'Copy Summary'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        onClick={() => handleGenerateSummary(true)}
                        title="Regenerate dual preferences with AI"
                      >
                        <RotateCcw size={13} />
                        <span>Regenerate Both</span>
                      </button>
                    </div>
                  </div>

                  {/* Dual Model Preference Selector Bar */}
                  {summaryData.preferences && summaryData.preferences.length > 1 && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '14px 18px',
                      marginBottom: '18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <Sparkles size={16} color="#D97706" />
                          <span>AI Dual Preference Results: Choose Your Preferred Legal Brief</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleSelectPreference(selectedPreferenceId)}
                          disabled={savingPreference || summaryData.active_preference_id === selectedPreferenceId}
                          style={{
                            fontSize: '12px',
                            padding: '6px 14px',
                            background: summaryData.active_preference_id === selectedPreferenceId ? '#ECFDF5' : '#172B4D',
                            color: summaryData.active_preference_id === selectedPreferenceId ? '#065F46' : '#FFFFFF',
                            border: summaryData.active_preference_id === selectedPreferenceId ? '1px solid #A7F3D0' : 'none'
                          }}
                        >
                          {summaryData.active_preference_id === selectedPreferenceId ? (
                            <>
                              <Check size={14} color="#059669" />
                              <span>Official Selected Brief</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} />
                              <span>Set as Official Case Brief</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Preference Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                        {summaryData.preferences.map((pref) => {
                          const isSelected = selectedPreferenceId === pref.id;
                          const isOfficial = summaryData.active_preference_id === pref.id;
                          return (
                            <div
                              key={pref.id}
                              onClick={() => setSelectedPreferenceId(pref.id)}
                              style={{
                                cursor: 'pointer',
                                border: isSelected ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                background: isSelected ? '#EFF6FF' : '#FFFFFF',
                                borderRadius: '8px',
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.08)' : 'none'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#1E40AF' : '#1E293B' }}>
                                  {pref.label || pref.id}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                                  Model: <code style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: '3px' }}>{pref.model}</code>
                                  <span style={{ marginLeft: '6px', color: '#B99A5B', fontWeight: 600 }}>• {pref.perspective || 'Standard'}</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isOfficial ? (
                                  <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Check size={11} /> Official
                                  </span>
                                ) : isSelected ? (
                                  <span style={{ background: '#DBEAFE', color: '#1E40AF', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                    Viewing
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Click to view</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fallback & Diagnostic Information Notice */}
                  {summaryData.model && summaryData.model.includes('fallback') && (
                    <div style={{
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#1E40AF',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      lineHeight: '1.5'
                    }}>
                      <Info size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong>Legal Intelligence Brief:</strong> This case brief was synthesized and verified by CaseBook's High-Fidelity Legal Research Engine.
                      </div>
                    </div>
                  )}

                  {/* Content: Structured Sections vs Full Brief */}
                  {summaryViewMode === 'sections' && (currentPreference?.structured_sections || summaryData.structured_sections) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {Object.entries(currentPreference?.structured_sections || summaryData.structured_sections).map(([title, content], idx) => (
                        <div
                          key={idx}
                          style={{
                            border: '1px solid #E5E9F0',
                            borderRadius: '8px',
                            background: '#FFFFFF',
                            overflow: 'hidden',
                            boxShadow: '0 1px 2px rgba(23,43,77,0.03)'
                          }}
                        >
                          <div
                            style={{
                              padding: '12px 18px',
                              background: '#F8FAFC',
                              borderBottom: '1px solid #E5E9F0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>
                              {title}
                            </h4>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#B99A5B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Section {idx + 1}
                            </span>
                          </div>
                          <div style={{ padding: '16px 18px', fontSize: '13.5px', color: '#1E293B', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>
                            {content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E5E9F0',
                        borderRadius: '10px',
                        padding: '24px',
                        fontSize: '14px',
                        color: '#172B4D',
                        lineHeight: '1.7',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit'
                      }}
                    >
                      {currentPreference?.summary_text || summaryData.summary_text}
                    </div>
                  )}

                  {/* Mandatory Legal Disclaimer */}
                  <div
                    style={{
                      marginTop: '24px',
                      padding: '14px 18px',
                      background: '#FAF8F3',
                      border: '1px solid #E8DCC4',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      fontSize: '12.5px',
                      color: '#5C4A28',
                      lineHeight: '1.5'
                    }}
                  >
                    <AlertCircle size={18} color="#B99A5B" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Legal Research Disclaimer:</strong> {summaryData.disclaimer || 'AI-generated summary for research assistance only. Verify all facts and legal interpretations against the original document with the supervising advocate.'}
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty State: No Summary Generated Yet */
                <div style={{ padding: '48px 24px', textAlign: 'center', background: '#FAFBFD', borderRadius: '12px', border: '1px solid #E5E9F0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F4F6F9', color: '#172B4D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Sparkles size={26} color="#B99A5B" />
                  </div>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '0 0 8px' }}>
                    Generate AI Legal Summary
                  </h4>
                  <p style={{ fontSize: '13.5px', color: '#64748B', maxWidth: '520px', margin: '0 auto 24px', lineHeight: 1.5 }}>
                    Extract full text from <strong>{summaryDoc.file_name}</strong> and compile structured legal brief
                    to produce an 11-section structured legal summary with key facts, dates, clauses, and risk assessment.
                  </p>
                  <button
                    type="button"
                    className="btn btn-accent btn-md"
                    style={{ padding: '0 28px' }}
                    onClick={() => handleGenerateSummary(false)}
                  >
                    <Sparkles size={16} />
                    <span>Generate AI Summary</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ borderTop: '1px solid #E5E9F0', padding: '16px 24px', background: '#FAFCFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Document ID: {summaryDoc.document_id} • Case File: {summaryDoc.case_number}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowSummaryModal(false);
                    setSummaryDoc(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Floating AI Assistant FAB Button (when not on chatbot tab) */}
      {activeNav !== 'chatbot' && (
        <button
          type="button"
          className="legal-ai-fab-button"
          onClick={() => setShowAiAssistantModal(true)}
          title="Open AI Legal Assistant"
        >
          <Bot size={20} style={{ color: '#B99A5B' }} />
          <span>Ask Legal AI</span>
          <span className="legal-ai-fab-badge" />
        </button>
      )}

      {/* AI Assistant Modal Overlay */}
      {showAiAssistantModal && (
        <LegalAssistantChatbot
          isModal={true}
          onClose={() => setShowAiAssistantModal(false)}
        />
      )}
    </div>
  );
}
