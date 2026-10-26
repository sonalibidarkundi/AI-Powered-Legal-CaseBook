import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Scale,
  LayoutDashboard,
  Briefcase,
  Users,
  UserCheck,
  UserPlus,
  FileText,
  Calendar,
  BarChart3,
  History,
  User,
  LogOut,
  Bell,
  Search,
  Filter,
  Plus,
  Eye,
  Edit3,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Menu,
  Sparkles,
  Bot,
  Download,
  FileCheck,
  Info,
  Check,
  Layers,
  TrendingUp,
  FolderOpen,
  Award,
  Gavel,
  Grid,
  List,
  Printer,
  PieChart,
  Activity,
  Zap,
  ClipboardList,
  AlertCircle
} from 'lucide-react';
import '../styles/Dashboard.css';
import LegalAssistantChatbot from '../components/LegalAssistantChatbot';

export default function AdvocateDashboard() {
  const { user, logout, csrfToken } = useAuth();

  // Active navigation tab
  const [activeNav, setActiveNav] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAiAssistantModal, setShowAiAssistantModal] = useState(false);

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
      const res = await fetch('/api/advocate/dashboard', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setOverviewData(data);
      } else {
        setOverviewError(data.error || 'Unable to retrieve practice dashboard statistics.');
      }
    } catch (err) {
      setOverviewError('Could not connect to the practice network. Please check network connection.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeNav === 'dashboard') {
      fetchOverview();
    }
  }, [activeNav, fetchOverview]);

  // --------------------------------------------------------------------------
  // 2. CASE MANAGEMENT STATE
  // --------------------------------------------------------------------------
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState(null);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState('ALL');
  const [caseTypeFilter, setCaseTypeFilter] = useState('ALL');

  // Case Modals
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showEditCaseModal, setShowEditCaseModal] = useState(false);
  const [showCaseDetailsModal, setShowCaseDetailsModal] = useState(false);
  const [selectedCaseDetails, setSelectedCaseDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [caseToEdit, setCaseToEdit] = useState(null);

  // Available clients for linking dropdown
  const [availableClients, setAvailableClients] = useState([]);

  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      const params = new URLSearchParams();
      if (caseSearch.trim()) params.append('q', caseSearch.trim());
      if (caseStatusFilter !== 'ALL') params.append('status', caseStatusFilter);
      if (caseTypeFilter !== 'ALL') params.append('case_type', caseTypeFilter);

      const res = await fetch(`/api/advocate/cases?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setCases(data.cases || []);
      } else {
        setCasesError(data.error || 'Failed to load case files.');
      }
    } catch (err) {
      setCasesError('Network error retrieving case files.');
    } finally {
      setCasesLoading(false);
    }
  }, [caseSearch, caseStatusFilter, caseTypeFilter]);

  const fetchAvailableClients = useCallback(async () => {
    try {
      const res = await fetch('/api/advocate/clients?scope=available', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAvailableClients(data.clients || []);
      }
    } catch (err) {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    if (activeNav === 'cases' || activeNav === 'assign-staff') {
      fetchCases();
      fetchAvailableClients();
    }
  }, [activeNav, fetchCases, fetchAvailableClients]);

  const viewCaseDetails = async (caseId) => {
    setDetailsLoading(true);
    setShowCaseDetailsModal(true);
    try {
      const res = await fetch(`/api/advocate/cases/${caseId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setSelectedCaseDetails(data);
      } else {
        setSelectedCaseDetails({ error: data.error || 'Could not load case details.' });
      }
    } catch (err) {
      setSelectedCaseDetails({ error: 'Network error loading case details.' });
    } finally {
      setDetailsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 3. CLIENT MANAGEMENT STATE
  // --------------------------------------------------------------------------
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showClientProfileModal, setShowClientProfileModal] = useState(false);
  const [selectedClientProfile, setSelectedClientProfile] = useState(null);
  const [clientProfileLoading, setClientProfileLoading] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);

  const fetchClients = useCallback(async () => {
    setClientsLoading(true);
    setClientsError(null);
    try {
      const params = new URLSearchParams();
      if (clientSearch.trim()) params.append('q', clientSearch.trim());
      const res = await fetch(`/api/advocate/clients?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setClients(data.clients || []);
      } else {
        setClientsError(data.error || 'Failed to load client records.');
      }
    } catch (err) {
      setClientsError('Network error retrieving client records.');
    } finally {
      setClientsLoading(false);
    }
  }, [clientSearch]);

  useEffect(() => {
    if (activeNav === 'clients' || activeNav === 'dashboard') {
      fetchClients();
    }
  }, [activeNav, fetchClients]);

  const viewClientProfile = async (clientId) => {
    setClientProfileLoading(true);
    setShowClientProfileModal(true);
    try {
      const res = await fetch(`/api/advocate/clients/${clientId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setSelectedClientProfile(data);
      } else {
        setSelectedClientProfile({ error: data.error || 'Could not load client profile.' });
      }
    } catch (err) {
      setSelectedClientProfile({ error: 'Network error loading client profile.' });
    } finally {
      setClientProfileLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 4. STAFF MANAGEMENT STATE
  // --------------------------------------------------------------------------
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState(null);
  const [staffSearch, setStaffSearch] = useState('');

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      const params = new URLSearchParams();
      if (staffSearch.trim()) params.append('q', staffSearch.trim());
      const res = await fetch(`/api/advocate/staff?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setStaffList(data.staff || []);
      } else {
        setStaffError(data.error || 'Failed to load staff roster.');
      }
    } catch (err) {
      setStaffError('Network error retrieving staff roster.');
    } finally {
      setStaffLoading(false);
    }
  }, [staffSearch]);

  useEffect(() => {
    if (activeNav === 'staff' || activeNav === 'assign-staff' || activeNav === 'dashboard') {
      fetchStaff();
    }
  }, [activeNav, fetchStaff]);

  // --------------------------------------------------------------------------
  // 5. ASSIGN STAFF WORKFLOW STATE
  // --------------------------------------------------------------------------
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignCaseId, setAssignCaseId] = useState('');
  const [assignStaffId, setAssignStaffId] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignBanner, setAssignBanner] = useState(null); // { type: 'success' | 'error', message: string }

  const fetchAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    try {
      const res = await fetch('/api/advocate/assignments', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      // non-blocking
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  // Delegated Research Tasks state for Advocate
  const [advocateTasks, setAdvocateTasks] = useState([]);
  const [advocateTasksLoading, setAdvocateTasksLoading] = useState(false);
  const [advocateTaskFilter, setAdvocateTaskFilter] = useState('ALL');
  const [selectedTaskNoteModal, setSelectedTaskNoteModal] = useState(null);

  const fetchAdvocateTasks = useCallback(async () => {
    setAdvocateTasksLoading(true);
    try {
      const res = await fetch('/api/advocate/tasks', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setAdvocateTasks(data.tasks || []);
      }
    } catch (err) {
      // non-blocking
    } finally {
      setAdvocateTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeNav === 'assign-staff' || activeNav === 'dashboard' || activeNav === 'staff') {
      fetchAssignments();
      fetchAdvocateTasks();
    }
  }, [activeNav, fetchAssignments, fetchAdvocateTasks]);

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssignBanner(null);

    if (!assignCaseId) {
      setAssignBanner({ type: 'error', message: 'Please select a case to assign.' });
      return;
    }
    if (!assignStaffId) {
      setAssignBanner({ type: 'error', message: 'Please select a staff member.' });
      return;
    }

    setAssignSubmitting(true);
    try {
      const res = await fetch('/api/advocate/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          case_id: parseInt(assignCaseId, 10),
          staff_id: parseInt(assignStaffId, 10),
          instructions: assignInstructions.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAssignBanner({ type: 'success', message: data.message || 'Staff assigned successfully!' });
        setAssignInstructions('');
        fetchAssignments();
        fetchStaff();
      } else {
        setAssignBanner({ type: 'error', message: data.error || 'Failed to complete assignment.' });
      }
    } catch (err) {
      setAssignBanner({ type: 'error', message: 'Network error processing assignment.' });
    } finally {
      setAssignSubmitting(false);
    }
  };


  // --------------------------------------------------------------------------
  // 7. DOCUMENT VAULT & AI SUMMARY STATE
  // --------------------------------------------------------------------------
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState(null);
  const [documentSearch, setDocumentSearch] = useState('');
  const [docViewMode, setDocViewMode] = useState('grid'); // 'grid' | 'table'
  const [docFilter, setDocFilter] = useState('all'); // 'all' | 'briefed' | 'pending'

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Document AI Summary Modal State (Dual Preference)
  const [summaryDoc, setSummaryDoc] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [selectedPreferenceId, setSelectedPreferenceId] = useState('pref_1');
  const [savingPreference, setSavingPreference] = useState(false);
  const [summaryViewMode, setSummaryViewMode] = useState('sections'); // 'sections' | 'raw'

  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const params = new URLSearchParams();
      if (documentSearch.trim()) params.append('q', documentSearch.trim());
      const res = await fetch(`/api/advocate/documents?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      } else {
        setDocumentsError(data.error || 'Failed to load documents.');
      }
    } catch (err) {
      setDocumentsError('Network error retrieving documents.');
    } finally {
      setDocumentsLoading(false);
    }
  }, [documentSearch]);

  useEffect(() => {
    if (activeNav === 'documents') {
      fetchDocuments();
    }
  }, [activeNav, fetchDocuments]);

  const openDocumentPreview = async (doc) => {
    setPreviewDoc(doc);
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/advocate/documents/${doc.document_id}/preview`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setPreviewData(data);
      } else {
        setPreviewData({ error: data.error || 'Unable to preview document.' });
      }
    } catch (err) {
      setPreviewData({ error: 'Network error loading preview.' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const openDocumentSummaryModal = useCallback(async (doc) => {
    setSummaryDoc(doc);
    setShowSummaryModal(true);
    setSummaryError(null);
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await fetch(`/api/advocate/documents/${doc.document_id}/summary`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.has_summary) {
        setSummaryData(data.summary);
        if (data.summary.active_preference_id) {
          setSelectedPreferenceId(data.summary.active_preference_id);
        } else if (data.summary.preferences && data.summary.preferences.length > 0) {
          setSelectedPreferenceId(data.summary.preferences[0].id);
        }
      }
    } catch (err) {
      // Non-blocking retrieval
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const handleGenerateSummary = async (regenerate = false) => {
    if (!summaryDoc) return;
    setSummaryGenerating(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/advocate/documents/${summaryDoc.document_id}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ regenerate })
      });
      const data = await res.json();
      if (res.ok) {
        setSummaryData(data.summary);
        if (data.summary.active_preference_id) {
          setSelectedPreferenceId(data.summary.active_preference_id);
        }
        fetchDocuments();
      } else {
        setSummaryError(data.error || 'Failed to generate summary.');
      }
    } catch (err) {
      setSummaryError('Network error while requesting AI brief.');
    } finally {
      setSummaryGenerating(false);
    }
  };

  const handleSelectPreference = async (prefId) => {
    if (!summaryDoc || !prefId) return;
    setSavingPreference(true);
    try {
      const res = await fetch(`/api/advocate/documents/${summaryDoc.document_id}/summary/preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ preference_id: prefId })
      });
      const data = await res.json();
      if (res.ok) {
        setSummaryData(prev => prev ? { ...prev, active_preference_id: prefId } : prev);
        setSelectedPreferenceId(prefId);
      }
    } catch (err) {
      // Non-blocking
    } finally {
      setSavingPreference(false);
    }
  };

  // --------------------------------------------------------------------------
  // 8. HEARINGS & COURT CALENDAR STATE
  // --------------------------------------------------------------------------
  const [hearings, setHearings] = useState([]);
  const [hearingsLoading, setHearingsLoading] = useState(false);
  const [hearingsError, setHearingsError] = useState(null);
  const [hearingSearch, setHearingSearch] = useState('');
  const [hearingStatusFilter, setHearingStatusFilter] = useState('ALL');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const fetchHearings = useCallback(async () => {
    setHearingsLoading(true);
    setHearingsError(null);
    try {
      const params = new URLSearchParams();
      if (hearingSearch.trim()) params.append('q', hearingSearch.trim());
      if (hearingStatusFilter !== 'ALL') params.append('status', hearingStatusFilter);
      const res = await fetch(`/api/advocate/hearings?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setHearings(data.hearings || []);
      } else {
        setHearingsError(data.error || 'Failed to load hearings.');
      }
    } catch (err) {
      setHearingsError('Network error retrieving hearings.');
    } finally {
      setHearingsLoading(false);
    }
  }, [hearingSearch, hearingStatusFilter]);

  useEffect(() => {
    if (activeNav === 'hearings') {
      fetchHearings();
      if (cases.length === 0) fetchCases();
    }
  }, [activeNav, fetchHearings, fetchCases, cases.length]);

  const handleUpdateHearingStatus = async (hearingId, newStatus) => {
    try {
      const res = await fetch(`/api/advocate/hearings/${hearingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ hearing_status: newStatus })
      });
      if (res.ok) {
        fetchHearings();
      }
    } catch (err) {
      // non-blocking
    }
  };

  // --------------------------------------------------------------------------
  // 9. REPORTS & PRACTICE ANALYTICS STATE
  // --------------------------------------------------------------------------
  const [reportsData, setReportsData] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);
  const [reportTimeframe, setReportTimeframe] = useState('all'); // 'all' | 'q4' | 'fy26'

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const res = await fetch('/api/advocate/reports', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setReportsData(data);
      } else {
        setReportsError(data.error || 'Failed to load reports.');
      }
    } catch (err) {
      setReportsError('Network error retrieving reports.');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeNav === 'reports') {
      fetchReports();
    }
  }, [activeNav, fetchReports]);

  // Status badge styling helper
  const renderStatusBadge = (status) => {
    const s = (status || '').toLowerCase().replace(/_/g, '-');
    return <span className={`badge-status ${s}`}>{status || 'UNKNOWN'}</span>;
  };

  return (
    <div className="dashboard-layout">
      {/* --------------------------------------------------------------------
          SIDEBAR NAVIGATION (11 Items)
          -------------------------------------------------------------------- */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'open' : ''}`} role="navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon" aria-hidden="true">
            <Scale size={22} strokeWidth={2.4} />
          </div>
          <div className="sidebar-brand-text">
            <h1>Legal CaseBook</h1>
            <span>Advocate Portal</span>
          </div>
        </div>

        <div className="sidebar-nav-container">
          <div className="sidebar-nav-group-title">Command Center</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setActiveNav('dashboard'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><LayoutDashboard size={18} /></span>
                <span>Dashboard</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-nav-group-title">Practice Management</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'cases' ? 'active' : ''}`}
                onClick={() => { setActiveNav('cases'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><Briefcase size={18} /></span>
                <span>Case Management</span>
              </button>
            </li>
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'clients' ? 'active' : ''}`}
                onClick={() => { setActiveNav('clients'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><Users size={18} /></span>
                <span>Client Management</span>
              </button>
            </li>
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'staff' ? 'active' : ''}`}
                onClick={() => { setActiveNav('staff'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><UserCheck size={18} /></span>
                <span>Staff Management</span>
              </button>
            </li>
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'assign-staff' ? 'active' : ''}`}
                onClick={() => { setActiveNav('assign-staff'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><UserPlus size={18} /></span>
                <span>Assign Staff</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-nav-group-title">Filing & Calendars</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'documents' ? 'active' : ''}`}
                onClick={() => { setActiveNav('documents'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><FileText size={18} /></span>
                <span>Documents</span>
                <span style={{ marginLeft: 'auto', background: '#3B82F6', color: '#FFFFFF', fontSize: '0.65rem', padding: '0.1rem 0.45rem', borderRadius: '9999px', fontWeight: 700 }}>Vault</span>
              </button>
            </li>
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'hearings' ? 'active' : ''}`}
                onClick={() => { setActiveNav('hearings'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><Calendar size={18} /></span>
                <span>Hearings & Calendar</span>
                <span style={{ marginLeft: 'auto', background: '#F59E0B', color: '#FFFFFF', fontSize: '0.65rem', padding: '0.1rem 0.45rem', borderRadius: '9999px', fontWeight: 700 }}>Cause List</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-nav-group-title">AI Case Intelligence</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'chatbot' ? 'active' : ''}`}
                onClick={() => { setActiveNav('chatbot'); setMobileMenuOpen(false); }}
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

          <div className="sidebar-nav-group-title">Compliance & System</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'reports' ? 'active' : ''}`}
                onClick={() => { setActiveNav('reports'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><BarChart3 size={18} /></span>
                <span>Reports</span>
                <span style={{ marginLeft: 'auto', background: '#6366F1', color: '#FFFFFF', fontSize: '0.65rem', padding: '0.1rem 0.45rem', borderRadius: '9999px', fontWeight: 700 }}>Analytics</span>
              </button>
            </li>

            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'profile' ? 'active' : ''}`}
                onClick={() => { setActiveNav('profile'); setMobileMenuOpen(false); }}
              >
                <span className="sidebar-nav-icon"><User size={18} /></span>
                <span>Profile</span>
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

      {/* --------------------------------------------------------------------
          MAIN CONTENT AREA & TOPBAR
          -------------------------------------------------------------------- */}
      <div className="dashboard-main-wrapper">
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
                {activeNav === 'dashboard' && 'Dashboard Overview'}
                {activeNav === 'cases' && 'Case Management'}
                {activeNav === 'clients' && 'Client Management'}
                {activeNav === 'staff' && 'Staff Management'}
                {activeNav === 'assign-staff' && 'Assign Staff to Cases'}
                {activeNav === 'documents' && 'Document Repository'}
                {activeNav === 'hearings' && 'Hearings & Cause List'}
                {activeNav === 'reports' && 'Legal Analytics & Reports'}
                {activeNav === 'profile' && 'Advocate Profile'}
              </h2>
              <span>Firm Vault Connected • Secure TLS Session</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Notification Bell */}
            <div className="topbar-notifications">
              <button
                type="button"
                className="btn-icon-notify"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="View notifications"
              >
                <Bell size={18} />
                <span className="notify-badge-dot" />
              </button>

              {showNotifications && (
                <div className="notify-popover">
                  <div className="notify-popover-header">
                    <h4>Notifications</h4>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>Live</span>
                  </div>
                  <div className="notify-popover-list">
                    <div className="notify-item">
                      <strong>System Operational</strong>
                      <p style={{ margin: '2px 0 0 0' }}>All practice systems and security controls initialized.</p>
                      <div className="notify-item-time">Active Session</div>
                    </div>
                    <div className="notify-item">
                      <strong>Role Verified</strong>
                      <p style={{ margin: '2px 0 0 0' }}>Advocate privileged access granted.</p>
                      <div className="notify-item-time">Now</div>
                    </div>
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
            <div className="topbar-profile-chip">
              <div className="profile-avatar-circle" aria-hidden="true">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="profile-meta">
                <span className="profile-name">{user?.full_name || 'Senior Advocate'}</span>
                <span className="profile-badge-tag">Verified Advocate</span>
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-content-area" role="main">
          {/* ================================================================
              VIEW: AI LEGAL ASSISTANT (RAG CHATBOT)
              ================================================================ */}
          {activeNav === 'chatbot' && (
            <div style={{ height: 'calc(100vh - 120px)', minHeight: '680px', margin: '0 0 2rem 0' }}>
              <LegalAssistantChatbot />
            </div>
          )}

          {/* ================================================================
              VIEW 1: DASHBOARD OVERVIEW
              ================================================================ */}
          {activeNav === 'dashboard' && (
            <div>
              {/* Hero Banner */}
              <div className="advocate-hero-card">
                <div className="hero-info-section">
                  <h3>Welcome back, {user?.full_name || 'Advocate'}</h3>
                  <p>
                    Manage legal proceedings, file appearances, examine client records,
                    and delegate research and drafting briefs to firm staff members.
                  </p>
                </div>
                <div className="hero-security-pill">
                  <ShieldCheck size={16} />
                  <span>Advocate Privilege Active</span>
                </div>
              </div>

              {/* Database Unavailable Error Banner (Never fake numbers!) */}
              {overviewError && (
                <div className="db-error-alert" role="alert">
                  <AlertTriangle size={24} className="db-error-icon" />
                  <div className="db-error-body">
                    <h4>Firm Records Offline</h4>
                    <p>
                      {overviewError}
                      <br />
                      Per application guidelines, Legal CaseBook displays only authentic
                      records from practice files and strictly avoids unverified information.
                    </p>
                    <button type="button" className="btn-retry-conn" onClick={fetchOverview}>
                      <RefreshCw size={14} />
                      <span>Retry Connection</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 6 Summary Cards */}
              <div className="metrics-grid-6">
                <div className="metric-card navy-accent" onClick={() => setActiveNav('cases')} style={{ cursor: 'pointer' }} title="View all cases">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Total Cases</span>
                    <div className="metric-card-icon"><Briefcase size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.total_cases : '—')}
                  </div>
                  <div className="metric-card-footer">All filings on ledger • View cases</div>
                </div>

                <div className="metric-card gold-accent" onClick={() => setActiveNav('cases')} style={{ cursor: 'pointer' }} title="View active cases">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Active Cases</span>
                    <div className="metric-card-icon"><Clock size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.active_cases : '—')}
                  </div>
                  <div className="metric-card-footer">Open & in trial • View cases</div>
                </div>

                <div className="metric-card" onClick={() => setActiveNav('cases')} style={{ cursor: 'pointer' }} title="View closed cases">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Closed Cases</span>
                    <div className="metric-card-icon"><CheckCircle2 size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.closed_cases : '—')}
                  </div>
                  <div className="metric-card-footer">Disposed & archived • View cases</div>
                </div>

                <div className="metric-card navy-accent" onClick={() => setActiveNav('clients')} style={{ cursor: 'pointer' }} title="Manage clients">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Total Clients</span>
                    <div className="metric-card-icon"><Users size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.total_clients : '—')}
                  </div>
                  <div className="metric-card-footer">Authorized litigants • View clients</div>
                </div>

                <div className="metric-card" onClick={() => setActiveNav('staff')} style={{ cursor: 'pointer' }} title="Manage staff">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Total Staff</span>
                    <div className="metric-card-icon"><UserCheck size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.total_staff : '—')}
                  </div>
                  <div className="metric-card-footer">Active firm members • View staff</div>
                </div>

                <div className="metric-card gold-accent" onClick={() => setActiveNav('hearings')} style={{ cursor: 'pointer' }} title="View cause list">
                  <div className="metric-card-header">
                    <span className="metric-card-title">Upcoming Hearings</span>
                    <div className="metric-card-icon"><Calendar size={16} /></div>
                  </div>
                  <div className="metric-card-value">
                    {overviewLoading ? '...' : (overviewData ? overviewData.metrics.upcoming_hearings : '—')}
                  </div>
                  <div className="metric-card-footer">Cause list appearances • View calendar</div>
                </div>
              </div>

              {/* 4 Recent Streams Grid */}
              <div className="dashboard-streams-grid">
                {/* 1. Recent Cases */}
                <div className="stream-card">
                  <div className="stream-card-header">
                    <h3><Briefcase size={16} /> Recent Cases</h3>
                    <button type="button" className="btn-stream-link" onClick={() => setActiveNav('cases')}>
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="stream-card-body">
                    {overviewData && overviewData.recent_cases.length > 0 ? (
                      <table className="stream-table">
                        <thead>
                          <tr>
                            <th>Case #</th>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData.recent_cases.map((c) => (
                            <tr key={c.case_id}>
                              <td><strong>{c.case_number}</strong></td>
                              <td>{c.title}</td>
                              <td>{renderStatusBadge(c.case_status)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => viewCaseDetails(c.case_id)}
                                  title="View details"
                                >
                                  <Eye size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty-state-box">
                        <Briefcase size={28} className="empty-state-icon" />
                        <h4>No Recent Cases</h4>
                        <p>Active practice case files will be listed here.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Upcoming Hearings */}
                <div className="stream-card">
                  <div className="stream-card-header">
                    <h3><Calendar size={16} /> Upcoming Hearings</h3>
                    <button type="button" className="btn-stream-link" onClick={() => setActiveNav('hearings')}>
                      Cause List <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="stream-card-body">
                    {overviewData && overviewData.upcoming_hearings.length > 0 ? (
                      <table className="stream-table">
                        <thead>
                          <tr>
                            <th>Court / Forum</th>
                            <th>Case</th>
                            <th>Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData.upcoming_hearings.map((h) => (
                            <tr key={h.hearing_id}>
                              <td><strong>{h.court_name}</strong></td>
                              <td>{h.case_title}</td>
                              <td>{new Date(h.hearing_date).toLocaleDateString()}</td>
                              <td>{renderStatusBadge(h.hearing_status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty-state-box">
                        <Calendar size={28} className="empty-state-icon" />
                        <h4>No Upcoming Hearings</h4>
                        <p>Scheduled court hearings will appear as they are registered.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Recent Documents */}
                <div className="stream-card">
                  <div className="stream-card-header">
                    <h3><FileText size={16} /> Recent Documents</h3>
                    <button type="button" className="btn-stream-link" onClick={() => setActiveNav('documents')}>
                      Vault <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="stream-card-body">
                    {overviewData && overviewData.recent_documents.length > 0 ? (
                      <table className="stream-table">
                        <thead>
                          <tr>
                            <th>File Name</th>
                            <th>Case #</th>
                            <th>Uploaded By</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData.recent_documents.map((d) => (
                            <tr key={d.document_id}>
                              <td><strong>{d.file_name}</strong></td>
                              <td>{d.case_number}</td>
                              <td>{d.uploaded_by_name}</td>
                              <td>{new Date(d.uploaded_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty-state-box">
                        <FileText size={28} className="empty-state-icon" />
                        <h4>No Documents Yet</h4>
                        <p>Exhibits, petitions, and legal briefs will appear here.</p>
                      </div>
                    )}
                  </div>
                </div>


                {/* 5. Firm Staff Members */}
                <div className="stream-card">
                  <div className="stream-card-header">
                    <h3><UserCheck size={16} /> Firm Staff Roster</h3>
                    <button type="button" className="btn-stream-link" onClick={() => setActiveNav('staff')}>
                      Manage Staff <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="stream-card-body">
                    {overviewData && overviewData.active_staff && overviewData.active_staff.length > 0 ? (
                      <table className="stream-table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Staff Member</th>
                            <th>Workload</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData.active_staff.map((s) => (
                            <tr key={s.staff_id}>
                              <td>
                                <span className="badge-type" style={{ background: '#EBF1F5', color: '#172B4D', fontSize: '11px' }}>
                                  {s.employee_code}
                                </span>
                              </td>
                              <td>
                                <strong>{s.full_name}</strong>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>{s.email}</div>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: s.active_assignments_count > 0 ? '#172B4D' : '#94A3B8' }}>
                                  {s.active_assignments_count} active
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => {
                                    setAssignStaffId(s.staff_id.toString());
                                    setActiveNav('assign-staff');
                                  }}
                                  title="Assign Case"
                                >
                                  <UserPlus size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty-state-box">
                        <UserCheck size={28} className="empty-state-icon" />
                        <h4>No Staff Registered</h4>
                        <p>Firm paralegals and legal clerks will appear here.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Registered Clients & Litigants */}
                <div className="stream-card">
                  <div className="stream-card-header">
                    <h3><Users size={16} /> Client Directory</h3>
                    <button type="button" className="btn-stream-link" onClick={() => setActiveNav('clients')}>
                      All Clients <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="stream-card-body">
                    {overviewData && overviewData.recent_clients && overviewData.recent_clients.length > 0 ? (
                      <table className="stream-table">
                        <thead>
                          <tr>
                            <th>Litigant / Client</th>
                            <th>Contact</th>
                            <th>Matters</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData.recent_clients.map((cl) => (
                            <tr key={cl.client_id}>
                              <td>
                                <strong>{cl.full_name}</strong>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>{cl.email}</div>
                              </td>
                              <td>{cl.phone || '—'}</td>
                              <td>
                                <span className="badge-type" style={{ background: '#F1F5F9', color: '#0F172A', fontWeight: 600 }}>
                                  {cl.case_count} case(s)
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => viewClientProfile(cl.client_id)}
                                  title="View client profile"
                                >
                                  <Eye size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty-state-box">
                        <Users size={28} className="empty-state-icon" />
                        <h4>No Clients Registered</h4>
                        <p>Authorized litigants and clients will appear here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              VIEW 2: CASE MANAGEMENT
              ================================================================ */}
          {activeNav === 'cases' && (
            <div>
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Case Management</h2>
                  <p>Create, track, filter, and review authorized case files and court dockets.</p>
                </div>
                <div className="page-header-actions">
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => setShowNewCaseModal(true)}
                  >
                    <Plus size={16} />
                    <span>Create New Case</span>
                  </button>
                  <button type="button" className="btn-secondary-action" onClick={fetchCases}>
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
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
                    <option value="DISPOSED">Disposed</option>
                    <option value="CLOSED">Closed</option>
                    <option value="ARCHIVED">Archived</option>
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
                    <option value="CONSTITUTIONAL">Constitutional</option>
                    <option value="FAMILY">Family</option>
                    <option value="TAXATION">Taxation</option>
                    <option value="ARBITRATION">Arbitration</option>
                    <option value="LABOR">Labor</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* Cases Table */}
              {casesError && (
                <div className="banner-message error" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={16} />
                  <span>{casesError}</span>
                </div>
              )}

              <div className="data-table-container">
                <div className="table-responsive">
                  <table className="legal-data-table">
                    <thead>
                      <tr>
                        <th>Case Number</th>
                        <th>Title & Subject</th>
                        <th>Case Type</th>
                        <th>Associated Client</th>
                        <th>Status</th>
                        <th>Staff Active</th>
                        <th>Filed Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {casesLoading ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '36px' }}>
                            Loading active case files...
                          </td>
                        </tr>
                      ) : cases.length > 0 ? (
                        cases.map((c) => (
                          <tr key={c.case_id}>
                            <td>
                              <span className="table-cell-title">{c.case_number}</span>
                            </td>
                            <td>
                              <div className="table-cell-title">{c.title}</div>
                            </td>
                            <td>
                              <span className="badge-type">{c.case_type}</span>
                            </td>
                            <td>{c.client_name}</td>
                            <td>{renderStatusBadge(c.case_status)}</td>
                            <td>
                              <span style={{ fontWeight: 600, color: c.active_staff_count > 0 ? '#172B4D' : '#94A3B8' }}>
                                {c.active_staff_count} assigned
                              </span>
                            </td>
                            <td>{new Date(c.created_at).toLocaleDateString()}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="table-actions-cell" style={{ justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => viewCaseDetails(c.case_id)}
                                  title="View complete case file"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => {
                                    setCaseToEdit(c);
                                    setShowEditCaseModal(true);
                                  }}
                                  title="Edit case metadata"
                                >
                                  <Edit3 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8">
                            <div className="empty-state-box">
                              <Briefcase size={32} className="empty-state-icon" />
                              <h4>No Cases Found</h4>
                              <p>No records matched your search filters. Click "Create New Case" to register a case file.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              VIEW 3: CLIENT MANAGEMENT
              ================================================================ */}
          {activeNav === 'clients' && (
            <div>
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Client Management</h2>
                  <p>Review authorized legal clients, verify contact information, and inspect associated cases.</p>
                </div>
                <div className="page-header-actions">
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => setShowNewClientModal(true)}
                  >
                    <Plus size={16} />
                    <span>Onboard Client</span>
                  </button>
                  <button type="button" className="btn-secondary-action" onClick={fetchClients}>
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="filter-toolbar-card">
                <div className="search-input-group">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-field"
                    placeholder="Search clients by name, email, or telephone..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                </div>
              </div>

              {clientsError && (
                <div className="banner-message error" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={16} />
                  <span>{clientsError}</span>
                </div>
              )}

              {/* Clients Table */}
              <div className="data-table-container">
                <div className="table-responsive">
                  <table className="legal-data-table">
                    <thead>
                      <tr>
                        <th>Client Name</th>
                        <th>Email Address</th>
                        <th>Contact Phone</th>
                        <th>Primary Address</th>
                        <th>Active Matters</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientsLoading ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                            Loading client directory...
                          </td>
                        </tr>
                      ) : clients.length > 0 ? (
                        clients.map((cl) => (
                          <tr key={cl.client_id}>
                            <td>
                              <span className="table-cell-title">{cl.full_name}</span>
                            </td>
                            <td>{cl.email}</td>
                            <td>{cl.phone}</td>
                            <td>{cl.address}</td>
                            <td>
                              <strong>{cl.case_count}</strong> matter(s)
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="table-actions-cell" style={{ justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => viewClientProfile(cl.client_id)}
                                  title="View client profile & cases"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => {
                                    setClientToEdit(cl);
                                    setShowEditClientModal(true);
                                  }}
                                  title="Edit contact info"
                                >
                                  <Edit3 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6">
                            <div className="empty-state-box">
                              <Users size={32} className="empty-state-icon" />
                              <h4>No Clients Listed</h4>
                              <p>Clients associated with your cases will be listed here.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              VIEW 4: STAFF MANAGEMENT
              ================================================================ */}
          {activeNav === 'staff' && (
            <div>
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Staff Management</h2>
                  <p>Examine firm paralegals and legal clerks, their assignment workload, and employee codes.</p>
                </div>
                <div className="page-header-actions">
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => setActiveNav('assign-staff')}
                  >
                    <UserPlus size={16} />
                    <span>Assign to Case</span>
                  </button>
                  <button type="button" className="btn-secondary-action" onClick={fetchStaff}>
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="filter-toolbar-card">
                <div className="search-input-group">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-field"
                    placeholder="Search staff by name, email, or employee code..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                  />
                </div>
              </div>

              {staffError && (
                <div className="banner-message error" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={16} />
                  <span>{staffError}</span>
                </div>
              )}

              {/* Staff Table */}
              <div className="data-table-container">
                <div className="table-responsive">
                  <table className="legal-data-table">
                    <thead>
                      <tr>
                        <th>Employee Code</th>
                        <th>Staff Member</th>
                        <th>Firm Email</th>
                        <th>Active Workload</th>
                        <th>Joined Date</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffLoading ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                            Loading legal staff roster...
                          </td>
                        </tr>
                      ) : staffList.length > 0 ? (
                        staffList.map((s) => (
                          <tr key={s.staff_id}>
                            <td>
                              <span className="badge-type" style={{ background: '#EBF1F5', color: '#172B4D' }}>
                                {s.employee_code}
                              </span>
                            </td>
                            <td>
                              <span className="table-cell-title">{s.full_name}</span>
                            </td>
                            <td>{s.email}</td>
                            <td>
                              <span style={{ fontWeight: 600, color: s.active_assignments_count > 0 ? '#172B4D' : '#94A3B8' }}>
                                {s.active_assignments_count} active case(s)
                              </span>
                            </td>
                            <td>{new Date(s.joined_at).toLocaleDateString()}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn-secondary-action"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={() => {
                                  setAssignStaffId(s.staff_id.toString());
                                  setActiveNav('assign-staff');
                                }}
                              >
                                <UserPlus size={13} />
                                <span>Assign Case</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6">
                            <div className="empty-state-box">
                              <UserCheck size={32} className="empty-state-icon" />
                              <h4>No Staff Registered</h4>
                              <p>Firm staff members created by administration will be listed here.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              VIEW 5: ASSIGN STAFF TO CASES
              ================================================================ */}
          {activeNav === 'assign-staff' && (
            <div>
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Assign Staff to Cases</h2>
                  <p>
                    Delegate case briefing, legal research, or court bundles to authorized firm staff.
                    Assignments update immediately on the assigned staff member's portal.
                  </p>
                </div>
              </div>

              <div className="assign-staff-container">
                {/* Workflow Form */}
                <div className="assign-workflow-card">
                  <div className="workflow-header">
                    <h3>New Staff Assignment</h3>
                    <p>Select target case and eligible staff member.</p>
                  </div>

                  {assignBanner && (
                    <div className={`banner-message ${assignBanner.type}`}>
                      {assignBanner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      <span>{assignBanner.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleAssignSubmit}>
                    <div className="form-group-workflow">
                      <label htmlFor="assign-case-select">1. Select Target Case *</label>
                      <select
                        id="assign-case-select"
                        className="form-select-workflow"
                        value={assignCaseId}
                        onChange={(e) => setAssignCaseId(e.target.value)}
                        required
                      >
                        <option value="">-- Choose a Case File --</option>
                        {cases.map((c) => (
                          <option key={c.case_id} value={c.case_id}>
                            {c.case_number} - {c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group-workflow">
                      <label htmlFor="assign-staff-select">2. Select Staff Member *</label>
                      <select
                        id="assign-staff-select"
                        className="form-select-workflow"
                        value={assignStaffId}
                        onChange={(e) => setAssignStaffId(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Staff Member --</option>
                        {staffList.map((s) => (
                          <option key={s.staff_id} value={s.staff_id}>
                            {s.full_name} ({s.employee_code}) - {s.active_assignments_count} active
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group-workflow">
                      <label htmlFor="assign-instructions">3. Assignment Instructions / Scope</label>
                      <textarea
                        id="assign-instructions"
                        className="form-textarea-workflow"
                        placeholder="e.g. Conduct statutory research on Section 138, assemble petition annexures..."
                        value={assignInstructions}
                        onChange={(e) => setAssignInstructions(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-primary-action"
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={assignSubmitting}
                    >
                      {assignSubmitting ? (
                        <span>Validating Assignment...</span>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          <span>Confirm Staff Assignment</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Existing Assignments Table */}
                <div className="data-table-container">
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#FAFCFE' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
                      Active Staff Delegations
                    </h3>
                  </div>
                  <div className="table-responsive">
                    <table className="legal-data-table">
                      <thead>
                        <tr>
                          <th>Case</th>
                          <th>Assigned Staff</th>
                          <th>Instructions</th>
                          <th>Assigned Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignmentsLoading ? (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>
                              Loading assignments...
                            </td>
                          </tr>
                        ) : assignments.length > 0 ? (
                          assignments.map((a) => (
                            <tr key={a.assignment_id}>
                              <td>
                                <div className="table-cell-title">{a.case_number}</div>
                                <div className="table-cell-sub">{a.case_title}</div>
                              </td>
                              <td>
                                <div className="table-cell-title">{a.staff_name}</div>
                                <div className="table-cell-sub">{a.employee_code}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: '12px', color: '#475569', maxWidth: '280px' }}>
                                  {a.instructions || 'Standard case support'}
                                </div>
                              </td>
                              <td>{new Date(a.assigned_at).toLocaleDateString()}</td>
                              <td>{renderStatusBadge(a.assignment_status)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5">
                              <div className="empty-state-box">
                                <UserCheck size={28} className="empty-state-icon" />
                                <h4>No Assignments Registered</h4>
                                <p>Use the form on the left to delegate cases to staff members.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Delegated Research Tasks & Live Status Tracker */}
              <div className="data-table-container" style={{ marginTop: '24px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#FAFCFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#172B4D', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ClipboardList size={18} color="#B99A5B" />
                      <span>Delegated Research Tasks & Live Status Tracker</span>
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                      Live telemetry of legal research tasks delegated to staff. Real-time updates when staff submits status changes or findings.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className={`status-toggle-btn ${advocateTaskFilter === 'ALL' ? 'active' : ''}`}
                      onClick={() => setAdvocateTaskFilter('ALL')}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      All ({advocateTasks.length})
                    </button>
                    <button
                      type="button"
                      className={`status-toggle-btn ${advocateTaskFilter === 'PENDING' ? 'active pending' : ''}`}
                      onClick={() => setAdvocateTaskFilter('PENDING')}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      Pending ({advocateTasks.filter(t => t.status === 'PENDING').length})
                    </button>
                    <button
                      type="button"
                      className={`status-toggle-btn ${advocateTaskFilter === 'IN_PROGRESS' ? 'active in-progress' : ''}`}
                      onClick={() => setAdvocateTaskFilter('IN_PROGRESS')}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      In Progress ({advocateTasks.filter(t => t.status === 'IN_PROGRESS').length})
                    </button>
                    <button
                      type="button"
                      className={`status-toggle-btn ${advocateTaskFilter === 'COMPLETED' ? 'active completed' : ''}`}
                      onClick={() => setAdvocateTaskFilter('COMPLETED')}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      Completed ({advocateTasks.filter(t => t.status === 'COMPLETED').length})
                    </button>
                    <button
                      type="button"
                      className="btn-outline-small"
                      onClick={fetchAdvocateTasks}
                      title="Refresh Tasks"
                      style={{ padding: '5px 8px' }}
                    >
                      <RefreshCw size={12} className={advocateTasksLoading ? 'spinner-icon' : ''} />
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="legal-data-table">
                    <thead>
                      <tr>
                        <th>Task Title & Scope</th>
                        <th>Case Reference</th>
                        <th>Assigned Associate</th>
                        <th>Priority & Due</th>
                        <th>Live Staff Status</th>
                        <th>Submitted Research & Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advocateTasksLoading ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>
                            <RefreshCw size={18} className="spinner-icon" style={{ display: 'inline-block', marginRight: '6px' }} />
                            Loading delegated tasks status...
                          </td>
                        </tr>
                      ) : advocateTasks.filter(t => advocateTaskFilter === 'ALL' || t.status === advocateTaskFilter).length > 0 ? (
                        advocateTasks.filter(t => advocateTaskFilter === 'ALL' || t.status === advocateTaskFilter).map((t) => (
                          <tr key={t.task_id}>
                            <td>
                              <div className="table-cell-title" style={{ fontWeight: 600 }}>{t.title}</div>
                              {t.instructions && (
                                <div className="table-cell-sub" style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {t.instructions}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className="cell-code" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.case_number}</span>
                              <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.case_title}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#172B4D' }}>{t.staff_name}</div>
                              <code style={{ fontSize: '11px', background: '#F1F5F9', padding: '2px 5px', borderRadius: '4px' }}>
                                {t.employee_code}
                              </code>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span className={`priority-badge ${t.priority?.toLowerCase()}`} style={{ alignSelf: 'flex-start' }}>
                                  {t.priority}
                                </span>
                                <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                                  Due: {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No deadline'}
                                </span>
                              </div>
                            </td>
                            <td>
                              {t.status === 'COMPLETED' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ECFDF5', color: '#047857', padding: '4px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                  <CheckCircle2 size={13} />
                                  <span>Completed</span>
                                </span>
                              ) : t.status === 'IN_PROGRESS' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#EFF6FF', color: '#1D4ED8', padding: '4px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                  <Clock size={13} />
                                  <span>In Progress</span>
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#FFFBEB', color: '#B45309', padding: '4px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                  <AlertCircle size={13} />
                                  <span>Pending Action</span>
                                </span>
                              )}
                              {t.updated_at && (
                                <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                                  Updated: {new Date(t.updated_at).toLocaleDateString()}
                                </div>
                              )}
                            </td>
                            <td>
                              {t.research_notes ? (
                                <div>
                                  <div style={{ fontSize: '12px', color: '#334155', fontStyle: 'italic', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    "{t.research_notes}"
                                  </div>
                                  <button
                                    type="button"
                                    className="btn-outline-small"
                                    style={{ marginTop: '4px', fontSize: '11px', padding: '2px 8px' }}
                                    onClick={() => setSelectedTaskNoteModal(t)}
                                  >
                                    <Eye size={11} /> Read Submitted Notes
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>Awaiting notes from staff</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                            No research tasks found for selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              VIEW 6: DOCUMENTS (Document Vault & Grok AI Legal Briefs)
              ================================================================ */}
          {activeNav === 'documents' && (() => {
            const briefedCount = documents.filter(d => d.has_summary || d.assignment_status === 'ANALYZED').length;
            const totalVolumeKb = documents.reduce((acc, d) => acc + (d.file_size || 0), 0) / 1024;
            const uniqueCasesCount = new Set(documents.map(d => d.case_id)).size;
            const filteredDocs = documents.filter(doc => {
              if (docFilter === 'briefed') return doc.has_summary || doc.assignment_status === 'ANALYZED';
              if (docFilter === 'pending') return !doc.has_summary && doc.assignment_status !== 'ANALYZED';
              return true;
            });

            return (
              <div id="advocate-documents-view">
                {/* 1. Hero Header Banner */}
                <div className="doc-vault-hero">
                  <div className="doc-vault-hero-content">
                    <div>
                      <div className="doc-vault-badge-pill">
                        <Sparkles size={12} color="#B99A5B" />
                        <span>Enterprise Evidentiary Archive & AI Suite</span>
                      </div>
                      <h2>Document Vault & Intelligence Repository</h2>
                      <p>
                        High-assurance legal filings, court records, and evidentiary exhibits equipped with dual-preference Grok AI legal brief synthesis and safe text previews.
                      </p>
                    </div>
                    <div className="doc-vault-hero-actions">
                      <button type="button" className="btn-secondary-action" onClick={fetchDocuments} style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.2)' }}>
                        <RefreshCw size={14} className={documentsLoading ? 'spin' : ''} />
                        <span>Refresh Vault</span>
                      </button>
                    </div>
                  </div>
                </div>

                {documentsError && (
                  <div className="banner-message error" style={{ marginBottom: '20px' }}>
                    <AlertTriangle size={16} />
                    <span>{documentsError}</span>
                  </div>
                )}

                {/* 2. Quick Metrics Row */}
                <div className="doc-vault-metrics-row">
                  <div className="doc-metric-card">
                    <div className="doc-metric-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                      <FolderOpen size={22} />
                    </div>
                    <div className="doc-metric-info">
                      <span className="doc-metric-label">Vault Exhibits</span>
                      <span className="doc-metric-value">{documents.length}</span>
                      <span className="doc-metric-subtext">{uniqueCasesCount} active litigation matters</span>
                    </div>
                  </div>

                  <div className="doc-metric-card">
                    <div className="doc-metric-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                      <Sparkles size={22} />
                    </div>
                    <div className="doc-metric-info">
                      <span className="doc-metric-label">AI Brief Coverage</span>
                      <span className="doc-metric-value">{briefedCount} / {documents.length}</span>
                      <span className="doc-metric-subtext">
                        {briefedCount === documents.length && documents.length > 0 ? '100% Briefed with Grok' : 'Synthesis on demand'}
                      </span>
                    </div>
                  </div>

                  <div className="doc-metric-card">
                    <div className="doc-metric-icon" style={{ background: '#FFFBEB', color: '#D97706' }}>
                      <FileCheck size={22} />
                    </div>
                    <div className="doc-metric-info">
                      <span className="doc-metric-label">Judicial Extraction</span>
                      <span className="doc-metric-value">Verified</span>
                      <span className="doc-metric-subtext">Verified Text Extraction</span>
                    </div>
                  </div>

                  <div className="doc-metric-card">
                    <div className="doc-metric-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                      <Layers size={22} />
                    </div>
                    <div className="doc-metric-info">
                      <span className="doc-metric-label">Vault Footprint</span>
                      <span className="doc-metric-value">{totalVolumeKb.toFixed(1)} KB</span>
                      <span className="doc-metric-subtext">Certified Legal Vault</span>
                    </div>
                  </div>
                </div>

                {/* 3. Interactive Toolbar: Search, Filter Pills & View Switcher */}
                <div className="doc-control-bar">
                  <div className="search-input-wrap" style={{ flex: 1, minWidth: '260px' }}>
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search exhibits by file name, title, case ref, or uploader..."
                      value={documentSearch}
                      onChange={(e) => setDocumentSearch(e.target.value)}
                    />
                    {documentSearch && (
                      <button type="button" className="search-clear-btn" onClick={() => setDocumentSearch('')}>
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="doc-filter-pills">
                    <button
                      type="button"
                      className={`doc-filter-pill-btn ${docFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setDocFilter('all')}
                    >
                      All Filings ({documents.length})
                    </button>
                    <button
                      type="button"
                      className={`doc-filter-pill-btn ${docFilter === 'briefed' ? 'active' : ''}`}
                      onClick={() => setDocFilter('briefed')}
                    >
                      AI Brief Ready ({briefedCount})
                    </button>
                    <button
                      type="button"
                      className={`doc-filter-pill-btn ${docFilter === 'pending' ? 'active' : ''}`}
                      onClick={() => setDocFilter('pending')}
                    >
                      Awaiting Review ({documents.length - briefedCount})
                    </button>
                  </div>

                  <div className="doc-view-toggle-group">
                    <button
                      type="button"
                      className={`doc-view-toggle-btn ${docViewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setDocViewMode('grid')}
                      title="Dossier Card Grid"
                    >
                      <Grid size={14} />
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      className={`doc-view-toggle-btn ${docViewMode === 'table' ? 'active' : ''}`}
                      onClick={() => setDocViewMode('table')}
                      title="Compact Legal Table"
                    >
                      <List size={14} />
                      <span>Table</span>
                    </button>
                  </div>
                </div>

                {/* 4. Main Body: Card Grid or Data Table */}
                {documentsLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px 16px', color: '#64748B', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: '#B99A5B' }} />
                    Loading evidentiary records and legal summaries...
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="empty-state-box" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '48px 24px' }}>
                    <FileText size={36} className="empty-state-icon" style={{ color: '#94A3B8' }} />
                    <h4 style={{ margin: '12px 0 6px 0', fontSize: '16px', color: '#172B4D' }}>No Documents Found</h4>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>
                      {documentSearch
                        ? `No filings match "${documentSearch}". Try adjusting your keyword search or filter.`
                        : 'No documents match the selected filter.'}
                    </p>
                  </div>
                ) : docViewMode === 'grid' ? (
                  /* --- CARD DOSSIER GRID VIEW --- */
                  <div className="doc-card-grid">
                    {filteredDocs.map((doc) => {
                      const isBriefed = doc.has_summary || doc.assignment_status === 'ANALYZED';
                      return (
                        <div key={doc.document_id} className="doc-dossier-card">
                          <div>
                            <div className="doc-dossier-top">
                              <div className="doc-type-icon-box">
                                <FileText size={24} />
                              </div>
                              <div className="doc-dossier-header-info">
                                <div className="doc-case-tag-row">
                                  <span className="doc-case-badge">
                                    {doc.case_number}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                                    {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Active'}
                                  </span>
                                </div>
                                <h3 className="doc-dossier-title" title={doc.document_title || doc.file_name}>
                                  {doc.document_title || doc.file_name}
                                </h3>
                                <span className="doc-file-code-name" title={doc.file_name}>
                                  {doc.file_name}
                                </span>
                              </div>
                            </div>

                            <div className="doc-meta-strip">
                              <div className="doc-meta-item">
                                <span style={{ color: '#94A3B8' }}>Size: </span>
                                <strong>{doc.file_size > 0 ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}</strong>
                              </div>
                              <div className="doc-meta-item">
                                <span style={{ color: '#94A3B8' }}>Uploader: </span>
                                <strong>{doc.uploaded_by_name}</strong>
                              </div>
                              <div className="doc-meta-item">
                                <span style={{ color: '#94A3B8' }}>Reviewer: </span>
                                <strong>{doc.assigned_staff_name}</strong>
                              </div>
                            </div>

                            <div className={`doc-brief-banner ${isBriefed ? 'ready' : 'pending'}`}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isBriefed ? <Sparkles size={14} color="#059669" /> : <Clock size={14} color="#D97706" />}
                                <span>{isBriefed ? 'Dual Grok AI Brief Verified' : 'Awaiting AI Synthesis'}</span>
                              </div>
                              <span style={{ fontSize: '11px', opacity: 0.85 }}>
                                {isBriefed ? 'Pref 1 & 2 Ready' : 'Ready to Parse'}
                              </span>
                            </div>
                          </div>

                          <div className="doc-dossier-actions">
                            <button
                              type="button"
                              className="btn-doc-brief"
                              onClick={() => openDocumentSummaryModal(doc)}
                              title="Compare Dual AI Legal Briefs"
                            >
                              <Sparkles size={14} />
                              <span>AI Brief</span>
                            </button>
                            <button
                              type="button"
                              className="btn-doc-preview"
                              onClick={() => openDocumentPreview(doc)}
                              title="Safe Extracted Text Preview"
                            >
                              <Eye size={14} />
                              <span>Preview</span>
                            </button>
                            <a
                              href={`/api/advocate/documents/${doc.document_id}/download`}
                              className="btn-doc-download"
                              title="Download Original PDF"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* --- REFINED DATA TABLE VIEW --- */
                  <div className="data-table-container">
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Document & Filing</th>
                            <th>Matter / Case</th>
                            <th>Uploaded By</th>
                            <th>Staff Reviewer</th>
                            <th>AI Brief Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDocs.map((doc) => {
                            const isBriefed = doc.has_summary || doc.assignment_status === 'ANALYZED';
                            return (
                              <tr key={doc.document_id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ background: '#EFF6FF', color: '#2563EB', padding: '8px', borderRadius: '8px' }}>
                                      <FileText size={18} />
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: '#172B4D', fontSize: '13.5px' }}>
                                        {doc.document_title || doc.file_name}
                                      </div>
                                      <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                        <code>{doc.file_name}</code>
                                        {doc.file_size > 0 && <span>• {(doc.file_size / 1024).toFixed(1)} KB</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700, color: '#172B4D', fontSize: '13px' }}>
                                    <span className="badge-type" style={{ background: '#F1F5F9', color: '#334155', marginRight: '6px' }}>
                                      {doc.case_number}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {doc.case_title}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '13px' }}>{doc.uploaded_by_name}</div>
                                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                                    {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontSize: '12px', color: doc.assigned_staff_name !== 'Unassigned' ? '#1E293B' : '#94A3B8', fontWeight: 500 }}>
                                    {doc.assigned_staff_name}
                                  </span>
                                </td>
                                <td>
                                  {isBriefed ? (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      background: '#ECFDF5',
                                      color: '#065F46',
                                      border: '1px solid #A7F3D0',
                                      padding: '3px 10px',
                                      borderRadius: '9999px',
                                      fontSize: '12px',
                                      fontWeight: 600
                                    }}>
                                      <Sparkles size={12} color="#059669" />
                                      <span>Dual AI Brief Ready</span>
                                    </span>
                                  ) : (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      background: '#FFFBEB',
                                      color: '#92400E',
                                      border: '1px solid #FDE68A',
                                      padding: '3px 10px',
                                      borderRadius: '9999px',
                                      fontSize: '12px',
                                      fontWeight: 600
                                    }}>
                                      <Clock size={12} color="#D97706" />
                                      <span>Awaiting Synthesis</span>
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="btn-table-action"
                                      onClick={() => openDocumentSummaryModal(doc)}
                                      title="View Dual AI Legal Brief"
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(185, 154, 91, 0.12) 0%, rgba(23, 43, 77, 0.08) 100%)',
                                        color: '#B99A5B',
                                        border: '1px solid rgba(185, 154, 91, 0.3)',
                                        fontWeight: 600
                                      }}
                                    >
                                      <Sparkles size={13} />
                                      <span>AI Brief</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-table-action"
                                      onClick={() => openDocumentPreview(doc)}
                                      title="Preview Text"
                                    >
                                      <Eye size={13} />
                                      <span>Preview</span>
                                    </button>
                                    <a
                                      href={`/api/advocate/documents/${doc.document_id}/download`}
                                      className="btn-table-action"
                                      title="Download Original"
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={13} />
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ================================================================
              VIEW 7: HEARINGS & CALENDAR (Cause List & Courtroom Scheduling)
              ================================================================ */}
          {activeNav === 'hearings' && (
            <div id="advocate-hearings-view">
              <div className="page-header-row">
                <div className="page-header-titles">
                  <h2>Court Calendar & Cause List</h2>
                  <p>Interactive bench appearances, trial dates, courtroom conflict management, and judicial order notes.</p>
                </div>
                <div className="page-header-actions">
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => setShowScheduleModal(true)}
                  >
                    <Plus size={15} />
                    <span>Schedule Hearing</span>
                  </button>
                  <button type="button" className="btn-secondary-action" onClick={fetchHearings}>
                    <RefreshCw size={14} className={hearingsLoading ? 'spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {hearingsError && (
                <div className="banner-message error" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={16} />
                  <span>{hearingsError}</span>
                </div>
              )}

              {/* Filter and Tab Bar */}
              <div className="filter-card-bar" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div className="search-input-wrap" style={{ flex: 1, minWidth: '220px' }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by case, court, courtroom, judge, or notes..."
                    value={hearingSearch}
                    onChange={(e) => setHearingSearch(e.target.value)}
                  />
                  {hearingSearch && (
                    <button type="button" className="search-clear-btn" onClick={() => setHearingSearch('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {['ALL', 'UPCOMING', 'SCHEDULED', 'CONCLUDED', 'ADJOURNED'].map((statusKey) => (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => setHearingStatusFilter(statusKey)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: hearingStatusFilter === statusKey ? '1px solid #172B4D' : '1px solid #E2E8F0',
                        background: hearingStatusFilter === statusKey ? '#172B4D' : '#FFFFFF',
                        color: hearingStatusFilter === statusKey ? '#FFFFFF' : '#64748B',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {statusKey === 'ALL' ? 'All Hearings' : statusKey}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cause List Table */}
              <div className="data-table-container">
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Matter / Case</th>
                        <th>Court & Forum</th>
                        <th>Presiding Bench</th>
                        <th>Status</th>
                        <th>Purpose & Agenda</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hearingsLoading ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
                            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', display: 'block', color: '#B99A5B' }} />
                            Retrieving court appearances from cause list...
                          </td>
                        </tr>
                      ) : hearings.length > 0 ? (
                        hearings.map((h) => {
                          const hDate = new Date(h.hearing_date);
                          const isPast = hDate < new Date();
                          return (
                            <tr key={h.hearing_id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    background: isPast ? '#F1F5F9' : '#FEF3C7',
                                    color: isPast ? '#64748B' : '#B45309',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    textAlign: 'center',
                                    minWidth: '45px'
                                  }}>
                                    <div>{hDate.toLocaleDateString(undefined, { month: 'short' })}</div>
                                    <div style={{ fontSize: '15px', lineHeight: 1 }}>{hDate.getDate()}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '13px' }}>
                                      {hDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                                      {hDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric' })}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: '#172B4D', fontSize: '13px' }}>
                                  <span className="badge-type" style={{ background: '#EFF6FF', color: '#1D4ED8', marginRight: '6px' }}>
                                    {h.case_number}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {h.case_title}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '13px' }}>{h.court_name}</div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{h.court_room}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: '13px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <Gavel size={13} color="#B99A5B" />
                                  <span>{h.judge_name}</span>
                                </div>
                              </td>
                              <td>
                                {h.hearing_status === 'SCHEDULED' ? (
                                  <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                                    SCHEDULED
                                  </span>
                                ) : h.hearing_status === 'CONCLUDED' ? (
                                  <span style={{ background: '#D1FAE5', color: '#065F46', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                                    CONCLUDED
                                  </span>
                                ) : (
                                  <span style={{ background: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                                    {h.hearing_status}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ fontSize: '12px', color: '#475569', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.notes}>
                                  {h.notes || 'Routine cause list listing'}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  {h.hearing_status === 'SCHEDULED' ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn-table-action"
                                        onClick={() => handleUpdateHearingStatus(h.hearing_id, 'CONCLUDED')}
                                        title="Mark as Concluded"
                                        style={{ color: '#059669' }}
                                      >
                                        <Check size={13} />
                                        <span>Conclude</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-table-action"
                                        onClick={() => handleUpdateHearingStatus(h.hearing_id, 'ADJOURNED')}
                                        title="Adjourn to Next Date"
                                        style={{ color: '#D97706' }}
                                      >
                                        <Clock size={13} />
                                        <span>Adjourn</span>
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-table-action"
                                      onClick={() => handleUpdateHearingStatus(h.hearing_id, 'SCHEDULED')}
                                      title="Re-open / Mark Scheduled"
                                    >
                                      <RefreshCw size={13} />
                                      <span>Re-list</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="7">
                            <div className="empty-state-box">
                              <Calendar size={32} className="empty-state-icon" />
                              <h4>No Hearings Scheduled</h4>
                              <p>
                                {hearingSearch || hearingStatusFilter !== 'ALL'
                                  ? 'No appearances match your criteria. Try resetting the filters.'
                                  : 'Click "+ Schedule Hearing" above to register upcoming bench appearances.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              VIEW 8: REPORTS & PRACTICE ANALYTICS (Executive Intelligence)
              ================================================================ */}
          {activeNav === 'reports' && (
            <div id="advocate-reports-view">
              {/* 1. Executive Intelligence Hero Banner */}
              <div className="reports-hero-banner">
                <div className="reports-hero-top">
                  <div>
                    <div className="reports-hero-badge">
                      <Award size={12} color="#F8E7B9" />
                      <span>Executive Practice Intelligence & Performance Audit</span>
                    </div>
                    <h2>Legal Practice Analytics & Operational Intelligence</h2>
                    <p>
                      Comprehensive real-time telemetry on litigation disposition, portfolio distribution, associate capacity utilization, and court appearance velocity.
                    </p>
                  </div>
                  <div className="reports-hero-btn-group">
                    <button
                      type="button"
                      className="btn-reports-print"
                      onClick={() => window.print()}
                      title="Generate Printable Executive Dossier"
                    >
                      <Printer size={15} />
                      <span>Print Dossier</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-action"
                      onClick={fetchReports}
                      style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                      <RefreshCw size={14} className={reportsLoading ? 'spin' : ''} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
              </div>

              {reportsError && (
                <div className="banner-message error" style={{ marginBottom: '20px' }}>
                  <AlertTriangle size={16} />
                  <span>{reportsError}</span>
                </div>
              )}

              {reportsLoading && !reportsData ? (
                <div style={{ textAlign: 'center', padding: '60px 16px', color: '#64748B', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <RefreshCw size={32} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: '#B99A5B' }} />
                  Aggregating practice metrics and real-time legal intelligence...
                </div>
              ) : reportsData ? (
                <div>
                  {/* 2. Strategic Practice Callout Banner */}
                  <div className="reports-insight-callout">
                    <div className="reports-insight-icon">
                      <Activity size={20} />
                    </div>
                    <div className="reports-insight-text">
                      <h4>Strategic Practice Synopsis: Active Litigation Docket & Firm Readiness</h4>
                      <p>
                        The firm currently manages <strong>{reportsData.kpis?.active_cases || 0} active matters</strong> across corporate, civil, and domestic relations.
                        All evidentiary exhibits in the vault are indexed and briefed with Grok AI dual models. Associate capacity is currently in optimal equilibrium.
                      </p>
                    </div>
                  </div>

                  {/* 3. Elevated KPI Cards Grid */}
                  <div className="reports-kpi-grid">
                    <div className="reports-kpi-card" style={{ borderTop: '3px solid #2563EB' }}>
                      <div className="reports-kpi-top">
                        <span className="reports-kpi-title">Total Practice Cases</span>
                        <div className="reports-kpi-icon-wrap" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                          <Briefcase size={18} />
                        </div>
                      </div>
                      <div className="reports-kpi-num">{reportsData.kpis?.total_cases ?? 0}</div>
                      <div className="reports-kpi-footer">
                        <span>Active & archived docket</span>
                        <span className="reports-kpi-pill" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>All-Time</span>
                      </div>
                    </div>

                    <div className="reports-kpi-card" style={{ borderTop: '3px solid #059669' }}>
                      <div className="reports-kpi-top">
                        <span className="reports-kpi-title">Active Matters</span>
                        <div className="reports-kpi-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
                          <Scale size={18} />
                        </div>
                      </div>
                      <div className="reports-kpi-num">{reportsData.kpis?.active_cases ?? 0}</div>
                      <div className="reports-kpi-footer">
                        <span>Ongoing litigation</span>
                        <span className="reports-kpi-pill" style={{ background: '#ECFDF5', color: '#047857' }}>Active</span>
                      </div>
                    </div>

                    <div className="reports-kpi-card" style={{ borderTop: '3px solid #7C3AED' }}>
                      <div className="reports-kpi-top">
                        <span className="reports-kpi-title">Disposed / Closed</span>
                        <div className="reports-kpi-icon-wrap" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                          <CheckCircle2 size={18} />
                        </div>
                      </div>
                      <div className="reports-kpi-num">{reportsData.kpis?.closed_cases ?? 0}</div>
                      <div className="reports-kpi-footer">
                        <span>Concluded judgments</span>
                        <span className="reports-kpi-pill" style={{ background: '#F5F3FF', color: '#6D28D9' }}>Resolved</span>
                      </div>
                    </div>

                    <div className="reports-kpi-card" style={{ borderTop: '3px solid #D97706' }}>
                      <div className="reports-kpi-top">
                        <span className="reports-kpi-title">Clients Represented</span>
                        <div className="reports-kpi-icon-wrap" style={{ background: '#FFFBEB', color: '#D97706' }}>
                          <Users size={18} />
                        </div>
                      </div>
                      <div className="reports-kpi-num">{reportsData.kpis?.total_clients ?? 0}</div>
                      <div className="reports-kpi-footer">
                        <span>Institutional & Private</span>
                        <span className="reports-kpi-pill" style={{ background: '#FFFBEB', color: '#B45309' }}>Retained</span>
                      </div>
                    </div>

                    <div className="reports-kpi-card" style={{ borderTop: '3px solid #0891B2' }}>
                      <div className="reports-kpi-top">
                        <span className="reports-kpi-title">Legal Associates</span>
                        <div className="reports-kpi-icon-wrap" style={{ background: '#ECFEFF', color: '#0891B2' }}>
                          <UserCheck size={18} />
                        </div>
                      </div>
                      <div className="reports-kpi-num">{reportsData.kpis?.total_staff ?? 0}</div>
                      <div className="reports-kpi-footer">
                        <span>Support force</span>
                        <span className="reports-kpi-pill" style={{ background: '#ECFEFF', color: '#0E7490' }}>Deployed</span>
                      </div>
                    </div>

                    <div className="reports-kpi-card" style={{ borderTop: '3px solid #DC2626' }}>
                      <div className="reports-kpi-top">
                        <span className="reports-kpi-title">Vault Filings</span>
                        <div className="reports-kpi-icon-wrap" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                          <FileText size={18} />
                        </div>
                      </div>
                      <div className="reports-kpi-num">{reportsData.kpis?.total_documents ?? 0}</div>
                      <div className="reports-kpi-footer">
                        <span>Verified exhibits</span>
                        <span className="reports-kpi-pill" style={{ background: '#FEF2F2', color: '#B91C1C' }}>AI Briefed</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Analytics Section: Practice Area & Litigation Lifecycle */}
                  <div className="reports-analytics-duo">
                    {/* Practice Area Distribution */}
                    <div className="reports-chart-card">
                      <div className="reports-chart-header">
                        <div className="reports-chart-title">
                          <Layers size={18} color="#B99A5B" />
                          <h3>Portfolio by Legal Practice Area</h3>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Active Docket Share</span>
                      </div>

                      <div>
                        {reportsData.cases_by_type && reportsData.cases_by_type.length > 0 ? (
                          reportsData.cases_by_type.map((t, idx) => {
                            const total = reportsData.kpis?.total_cases || 1;
                            const pct = Math.round((t.count / total) * 100);
                            return (
                              <div key={idx} className="reports-progress-row">
                                <div className="reports-progress-header">
                                  <span className="reports-progress-label">
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#B99A5B', display: 'inline-block' }} />
                                    <span>{t.type}</span>
                                  </span>
                                  <span className="reports-progress-value">{t.count} matter{t.count !== 1 ? 's' : ''} ({pct}%)</span>
                                </div>
                                <div className="reports-progress-track">
                                  <div
                                    className="reports-progress-fill"
                                    style={{
                                      width: `${pct}%`,
                                      background: 'linear-gradient(90deg, #172B4D 0%, #B99A5B 100%)'
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p style={{ fontSize: '13px', color: '#94A3B8' }}>No practice area records compiled.</p>
                        )}
                      </div>
                    </div>

                    {/* Case Disposition Breakdown */}
                    <div className="reports-chart-card">
                      <div className="reports-chart-header">
                        <div className="reports-chart-title">
                          <TrendingUp size={18} color="#2563EB" />
                          <h3>Litigation Lifecycle & Disposition</h3>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Stage Health</span>
                      </div>

                      <div>
                        {reportsData.cases_by_status && reportsData.cases_by_status.length > 0 ? (
                          reportsData.cases_by_status.map((st, idx) => {
                            const total = reportsData.kpis?.total_cases || 1;
                            const pct = Math.round((st.count / total) * 100);
                            const color =
                              st.status === 'OPEN' ? '#2563EB' :
                              st.status === 'PENDING_HEARING' ? '#D97706' :
                              st.status === 'IN_TRIAL' ? '#7C3AED' :
                              st.status === 'DISPOSED' || st.status === 'CLOSED' ? '#059669' : '#64748B';
                            return (
                              <div key={idx} className="reports-progress-row">
                                <div className="reports-progress-header">
                                  <span className="reports-progress-label">
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                                    <span>{st.status.replace(/_/g, ' ')}</span>
                                  </span>
                                  <span className="reports-progress-value">{st.count} matter{st.count !== 1 ? 's' : ''} ({pct}%)</span>
                                </div>
                                <div className="reports-progress-track">
                                  <div
                                    className="reports-progress-fill"
                                    style={{
                                      width: `${pct}%`,
                                      background: color
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p style={{ fontSize: '13px', color: '#94A3B8' }}>No status breakdown records.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 5. Staff Workload & Performance Matrix */}
                  <div className="reports-matrix-card">
                    <div className="reports-matrix-header">
                      <h3>
                        <Award size={18} color="#D97706" />
                        <span>Staff Workload & Capacity Allocation Matrix</span>
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Real-Time Operational Telemetry</span>
                    </div>

                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Associate Member</th>
                            <th>Code</th>
                            <th>Active Cases</th>
                            <th>Completed Tasks</th>
                            <th>Pending Deliverables</th>
                            <th>Capacity Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportsData.staff_workload && reportsData.staff_workload.length > 0 ? (
                            reportsData.staff_workload.map((s) => (
                              <tr key={s.staff_id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className="staff-matrix-avatar">
                                      {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                                    </div>
                                    <div style={{ fontWeight: 700, color: '#172B4D', fontSize: '13.5px' }}>
                                      {s.name}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <code style={{ background: '#F1F5F9', padding: '3px 7px', borderRadius: '4px', fontSize: '12px' }}>
                                    {s.code || 'STF'}
                                  </code>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 800, color: '#1E293B', fontSize: '14px' }}>
                                    {s.active_cases}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: '#059669', fontWeight: 700, background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                    {s.completed_tasks} done
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: s.pending_tasks > 0 ? '#D97706' : '#94A3B8', fontWeight: 700, background: s.pending_tasks > 0 ? '#FFFBEB' : '#F8FAFC', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                    {s.pending_tasks} pending
                                  </span>
                                </td>
                                <td>
                                  {s.active_cases > 3 ? (
                                    <span style={{ background: '#FEF3C7', color: '#92400E', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                                      HIGH CAPACITY
                                    </span>
                                  ) : s.active_cases > 0 ? (
                                    <span style={{ background: '#DCFCE7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                                      OPTIMAL
                                    </span>
                                  ) : (
                                    <span style={{ background: '#F1F5F9', color: '#64748B', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                                      AVAILABLE
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', color: '#94A3B8', padding: '24px' }}>
                                No staff allocation metrics recorded.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}


          {/* ================================================================
              VIEW 10: PROFILE
              ================================================================ */}
          {activeNav === 'profile' && (
            <div className="placeholder-view-card" style={{ maxWidth: '600px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div className="profile-avatar-circle" style={{ width: '56px', height: '56px', fontSize: '20px' }}>
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{user?.full_name}</h3>
                  <span style={{ fontSize: '13px', color: '#B99A5B', fontWeight: 600 }}>Senior Advocate</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>Email Address</label>
                  <div style={{ fontSize: '14px', color: '#172B4D', fontWeight: 500 }}>{user?.email}</div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>Clearance Level</label>
                  <div style={{ fontSize: '14px', color: '#172B4D', fontWeight: 500 }}>ADVOCATE (Full Firm Access)</div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>Account Status</label>
                  <div>{renderStatusBadge(user?.account_status || 'ACTIVE')}</div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>Security & Compliance</label>
                  <div style={{ fontSize: '13px', color: '#475569' }}>Bank-Grade 256-Bit Encryption • Secure Token Auth • Protected Data Pipeline</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ====================================================================
          MODAL: CREATE NEW CASE
          ==================================================================== */}
      {showNewCaseModal && (
        <CreateCaseModal
          availableClients={availableClients}
          csrfToken={csrfToken}
          onClose={() => setShowNewCaseModal(false)}
          onSuccess={() => {
            setShowNewCaseModal(false);
            fetchCases();
          }}
        />
      )}

      {/* ====================================================================
          MODAL: EDIT CASE
          ==================================================================== */}
      {showEditCaseModal && caseToEdit && (
        <EditCaseModal
          caseData={caseToEdit}
          csrfToken={csrfToken}
          onClose={() => {
            setShowEditCaseModal(false);
            setCaseToEdit(null);
          }}
          onSuccess={() => {
            setShowEditCaseModal(false);
            setCaseToEdit(null);
            fetchCases();
          }}
        />
      )}

      {/* ====================================================================
          MODAL: CASE DETAILS
          ==================================================================== */}
      {showCaseDetailsModal && (
        <CaseDetailsModal
          loading={detailsLoading}
          details={selectedCaseDetails}
          onClose={() => {
            setShowCaseDetailsModal(false);
            setSelectedCaseDetails(null);
          }}
        />
      )}

      {/* ====================================================================
          MODAL: ONBOARD CLIENT
          ==================================================================== */}
      {showNewClientModal && (
        <OnboardClientModal
          cases={cases}
          csrfToken={csrfToken}
          onClose={() => setShowNewClientModal(false)}
          onSuccess={() => {
            setShowNewClientModal(false);
            fetchClients();
          }}
        />
      )}

      {/* ====================================================================
          MODAL: CLIENT PROFILE & LINKED CASES
          ==================================================================== */}
      {showClientProfileModal && (
        <ClientProfileModal
          loading={clientProfileLoading}
          profile={selectedClientProfile}
          onClose={() => {
            setShowClientProfileModal(false);
            setSelectedClientProfile(null);
          }}
        />
      )}

      {/* ====================================================================
          MODAL: EDIT CLIENT CONTACT
          ==================================================================== */}
      {showEditClientModal && clientToEdit && (
        <EditClientModal
          clientData={clientToEdit}
          csrfToken={csrfToken}
          onClose={() => {
            setShowEditClientModal(false);
            setClientToEdit(null);
          }}
          onSuccess={() => {
            setShowEditClientModal(false);
            setClientToEdit(null);
            fetchClients();
          }}
        />
      )}

      {/* ====================================================================
          MODAL: SCHEDULE HEARING
          ==================================================================== */}
      {showScheduleModal && (
        <ScheduleHearingModal
          cases={cases}
          csrfToken={csrfToken}
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            setShowScheduleModal(false);
            fetchHearings();
          }}
        />
      )}

      {/* ====================================================================
          MODAL: DOCUMENT PREVIEW
          ==================================================================== */}
      {previewModalOpen && (
        <DocumentPreviewModal
          previewData={previewData}
          loading={previewLoading}
          onClose={() => {
            setPreviewModalOpen(false);
            setPreviewData(null);
          }}
        />
      )}

      {/* ====================================================================
          MODAL: DOCUMENT AI SUMMARY (DUAL PREFERENCE)
          ==================================================================== */}
      {showSummaryModal && (
        <DocumentSummaryModal
          summaryDoc={summaryDoc}
          summaryData={summaryData}
          summaryLoading={summaryLoading}
          summaryGenerating={summaryGenerating}
          summaryError={summaryError}
          selectedPreferenceId={selectedPreferenceId}
          setSelectedPreferenceId={setSelectedPreferenceId}
          savingPreference={savingPreference}
          summaryViewMode={summaryViewMode}
          setSummaryViewMode={setSummaryViewMode}
          onGenerateSummary={handleGenerateSummary}
          onSelectPreference={handleSelectPreference}
          onClose={() => {
            setShowSummaryModal(false);
            setSummaryDoc(null);
            setSummaryData(null);
          }}
        />
      )}

      {/* ====================================================================
          MODAL: VIEW SUBMITTED RESEARCH TASK NOTES & FINDINGS
          ==================================================================== */}
      {selectedTaskNoteModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-large" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedTaskNoteModal.title}</h3>
                <span className="modal-subtitle">
                  Case: {selectedTaskNoteModal.case_number} • Submitted by: {selectedTaskNoteModal.staff_name} ({selectedTaskNoteModal.employee_code})
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedTaskNoteModal(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Current Status</span>
                  {selectedTaskNoteModal.status === 'COMPLETED' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ECFDF5', color: '#047857', padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                      <CheckCircle2 size={13} />
                      <span>Completed</span>
                    </span>
                  ) : selectedTaskNoteModal.status === 'IN_PROGRESS' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#EFF6FF', color: '#1D4ED8', padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                      <Clock size={13} />
                      <span>In Progress</span>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#FFFBEB', color: '#B45309', padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                      <AlertCircle size={13} />
                      <span>Pending Action</span>
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Priority</span>
                  <span className={`priority-badge ${selectedTaskNoteModal.priority?.toLowerCase()}`}>
                    {selectedTaskNoteModal.priority}
                  </span>
                </div>
                {selectedTaskNoteModal.updated_at && (
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Submitted Timestamp</span>
                    <span style={{ fontSize: '12px', color: '#1E293B', fontWeight: 600 }}>
                      {new Date(selectedTaskNoteModal.updated_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {selectedTaskNoteModal.instructions && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Delegation Instructions / Scope
                  </label>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                    {selectedTaskNoteModal.instructions}
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  <CheckCircle2 size={14} />
                  <span>Submitted Research Findings & Precedents (Work Results)</span>
                </label>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '14px', borderRadius: '8px', fontSize: '13.5px', color: '#166534', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                  {selectedTaskNoteModal.research_notes || 'No extended notes were entered for this task.'}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedTaskNoteModal(null)}
              >
                Done Reading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CONFIRM LOGOUT
          ==================================================================== */}
      {showLogoutConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Confirm Sign Out</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowLogoutConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
                Are you sure you want to sign out of the Legal CaseBook advocate portal?
                Your session will be securely terminated.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-action"
                style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
              >
                Sign Out
              </button>
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

// ============================================================================
// SUB-MODAL COMPONENTS
// ============================================================================

function CreateCaseModal({ availableClients, csrfToken, onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [caseType, setCaseType] = useState('CIVIL');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (title.trim().length < 3) {
      setErrorMsg('Case title must be at least 3 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        case_type: caseType,
        description: description.trim()
      };
      if (caseNumber.trim()) payload.case_number = caseNumber.trim();
      if (clientId) payload.client_id = parseInt(clientId, 10);

      const res = await fetch('/api/advocate/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setErrorMsg(data.error || 'Failed to create case record.');
      }
    } catch (err) {
      setErrorMsg('Network error communicating with the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Create New Case File</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div className="banner-message error">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group-workflow">
              <label>Case Title / Matter Subject *</label>
              <input
                type="text"
                className="form-input-workflow"
                placeholder="e.g. Apex Tech vs CloudSphere: Contract Licensing"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group-workflow">
              <label>Case Number (Leave blank to auto-generate)</label>
              <input
                type="text"
                className="form-input-workflow"
                placeholder="e.g. LCB-2026-003"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group-workflow">
                <label>Case Classification *</label>
                <select
                  className="form-select-workflow"
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                >
                  <option value="CIVIL">Civil Litigation</option>
                  <option value="CRIMINAL">Criminal Matter</option>
                  <option value="CORPORATE">Corporate & Commercial</option>
                  <option value="CONSTITUTIONAL">Constitutional / Writ</option>
                  <option value="FAMILY">Family Law</option>
                  <option value="TAXATION">Taxation & Customs</option>
                  <option value="ARBITRATION">Arbitration & Dispute</option>
                  <option value="LABOR">Labor & Employment</option>
                  <option value="OTHER">Other Matter</option>
                </select>
              </div>

              <div className="form-group-workflow">
                <label>Link Client Litigant</label>
                <select
                  className="form-select-workflow"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">-- No Client Attached --</option>
                  {availableClients.map((cl) => (
                    <option key={cl.client_id} value={cl.client_id}>
                      {cl.full_name} ({cl.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group-workflow">
              <label>Filing Summary / Matter Synopsis</label>
              <textarea
                className="form-textarea-workflow"
                placeholder="Provide details regarding the prayer, causes of action, or court forum..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary-action" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action" disabled={submitting}>
              {submitting ? 'Creating Case File...' : 'Create Case File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditCaseModal({ caseData, csrfToken, onClose, onSuccess }) {
  const [title, setTitle] = useState(caseData.title || '');
  const [description, setDescription] = useState(caseData.description || '');
  const [caseType, setCaseType] = useState(caseData.case_type || 'CIVIL');
  const [caseStatus, setCaseStatus] = useState(caseData.case_status || 'OPEN');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (title.trim().length < 3) {
      setErrorMsg('Case title must be at least 3 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/advocate/cases/${caseData.case_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          case_type: caseType,
          case_status: caseStatus
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setErrorMsg(data.error || 'Failed to update case.');
      }
    } catch (err) {
      setErrorMsg('Network error saving changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Edit Case: {caseData.case_number}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div className="banner-message error">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group-workflow">
              <label>Case Title *</label>
              <input
                type="text"
                className="form-input-workflow"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group-workflow">
                <label>Case Classification</label>
                <select
                  className="form-select-workflow"
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                >
                  <option value="CIVIL">Civil</option>
                  <option value="CRIMINAL">Criminal</option>
                  <option value="CORPORATE">Corporate</option>
                  <option value="CONSTITUTIONAL">Constitutional</option>
                  <option value="FAMILY">Family</option>
                  <option value="TAXATION">Taxation</option>
                  <option value="ARBITRATION">Arbitration</option>
                  <option value="LABOR">Labor</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="form-group-workflow">
                <label>Case Status</label>
                <select
                  className="form-select-workflow"
                  value={caseStatus}
                  onChange={(e) => setCaseStatus(e.target.value)}
                >
                  <option value="OPEN">Open</option>
                  <option value="PENDING_HEARING">Pending Hearing</option>
                  <option value="IN_TRIAL">In Trial</option>
                  <option value="DISPOSED">Disposed</option>
                  <option value="CLOSED">Closed</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            <div className="form-group-workflow">
              <label>Description / Notes</label>
              <textarea
                className="form-textarea-workflow"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary-action" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action" disabled={submitting}>
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CaseDetailsModal({ loading, details, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog large">
        <div className="modal-header">
          <h3>
            {loading ? 'Loading Case File...' : `Case File: ${details?.case_number || 'Details'}`}
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '48px' }}>
            <p>Retrieving case record, client relationships, and filings...</p>
          </div>
        ) : details?.error ? (
          <div className="modal-body">
            <div className="banner-message error">
              <AlertTriangle size={16} />
              <span>{details.error}</span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '0 24px', background: '#FAFCFE', borderBottom: '1px solid #E2E8F0' }}>
              <div className="modal-tabs">
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview & Notes
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
                  onClick={() => setActiveTab('clients')}
                >
                  Clients ({details?.clients?.length || 0})
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
                  onClick={() => setActiveTab('staff')}
                >
                  Assigned Staff ({details?.assigned_staff?.length || 0})
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setActiveTab('documents')}
                >
                  Documents ({details?.documents?.length || 0})
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'hearings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('hearings')}
                >
                  Hearings ({details?.hearings?.length || 0})
                </button>
              </div>
            </div>

            <div className="modal-body">
              {activeTab === 'overview' && (
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#172B4D' }}>
                    {details.title}
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <span className="badge-type">{details.case_type}</span>
                    <span className="badge-status open">{details.case_status}</span>
                  </div>

                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>
                      Description & Synopsis
                    </label>
                    <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: '#334155', lineHeight: 1.6 }}>
                      {details.description || 'No description entered.'}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                    <div>
                      <strong style={{ color: '#64748B' }}>Created By: </strong>
                      <span>{details.creator_name}</span>
                    </div>
                    <div>
                      <strong style={{ color: '#64748B' }}>Filing Date: </strong>
                      <span>{new Date(details.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'clients' && (
                <div>
                  {details.clients && details.clients.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {details.clients.map((c) => (
                        <div key={c.client_id} style={{ padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                          <h4 style={{ margin: '0 0 4px 0', color: '#172B4D' }}>{c.full_name}</h4>
                          <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                            <div>Email: {c.email}</div>
                            <div>Phone: {c.phone}</div>
                            <div>Address: {c.address}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8' }}>No clients attached to this case file.</p>
                  )}
                </div>
              )}

              {activeTab === 'staff' && (
                <div>
                  {details.assigned_staff && details.assigned_staff.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {details.assigned_staff.map((s) => (
                        <div key={s.assignment_id} style={{ padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ margin: 0, color: '#172B4D' }}>{s.full_name} ({s.employee_code})</h4>
                            <span className="badge-status open">{s.assignment_status}</span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '6px' }}>
                            <strong>Instructions: </strong> {s.instructions || 'Standard assignment'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                            Assigned on {new Date(s.assigned_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8' }}>No staff members currently assigned to this case file.</p>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  {details.documents && details.documents.length > 0 ? (
                    <table className="stream-table">
                      <thead>
                        <tr>
                          <th>File Name</th>
                          <th>Mime Type</th>
                          <th>Uploaded By</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.documents.map((d) => (
                          <tr key={d.document_id}>
                            <td><strong>{d.file_name}</strong></td>
                            <td>{d.mime_type}</td>
                            <td>{d.uploaded_by_name}</td>
                            <td>{new Date(d.uploaded_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: '#94A3B8' }}>No documents uploaded for this case.</p>
                  )}
                </div>
              )}

              {activeTab === 'hearings' && (
                <div>
                  {details.hearings && details.hearings.length > 0 ? (
                    <table className="stream-table">
                      <thead>
                        <tr>
                          <th>Court / Forum</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.hearings.map((h) => (
                          <tr key={h.hearing_id}>
                            <td><strong>{h.court_name}</strong></td>
                            <td>{new Date(h.hearing_date).toLocaleDateString()}</td>
                            <td><span className="badge-status open">{h.hearing_status}</span></td>
                            <td>{h.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: '#94A3B8' }}>No hearings scheduled for this case.</p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary-action" onClick={onClose}>Close File</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OnboardClientModal({ cases, csrfToken, onClose, onSuccess }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [caseId, setCaseId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (fullName.trim().length < 2) {
      setErrorMsg('Full client name must be at least 2 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim()
      };
      if (caseId) payload.case_id = parseInt(caseId, 10);

      const res = await fetch('/api/advocate/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setErrorMsg(data.error || 'Failed to onboard client.');
      }
    } catch (err) {
      setErrorMsg('Network error communicating with the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Onboard New Client</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div className="banner-message error">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group-workflow">
              <label>Full Name / Litigant Entity *</label>
              <input
                type="text"
                className="form-input-workflow"
                placeholder="e.g. Apex Tech Solutions Ltd or Dr. Kavita Rao"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group-workflow">
              <label>Client Email Address *</label>
              <input
                type="email"
                className="form-input-workflow"
                placeholder="client.apex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group-workflow">
                <label>Contact Phone</label>
                <input
                  type="text"
                  className="form-input-workflow"
                  placeholder="+91 98200 11223"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group-workflow">
                <label>Link Initial Case File</label>
                <select
                  className="form-select-workflow"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                >
                  <option value="">-- No Initial Link --</option>
                  {cases.map((c) => (
                    <option key={c.case_id} value={c.case_id}>
                      {c.case_number} - {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group-workflow">
              <label>Residential / Business Address</label>
              <textarea
                className="form-textarea-workflow"
                placeholder="Enter postal address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary-action" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action" disabled={submitting}>
              {submitting ? 'Registering Client...' : 'Onboard Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClientProfileModal({ loading, profile, onClose }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Client Profile & Cases</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '24px' }}>Loading client record...</p>
          ) : profile?.error ? (
            <div className="banner-message error">
              <AlertTriangle size={16} />
              <span>{profile.error}</span>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#172B4D' }}>
                  {profile?.full_name}
                </h4>
                <div style={{ fontSize: '13px', color: '#64748B' }}>
                  <div>Email: {profile?.email}</div>
                  <div>Phone: {profile?.phone || 'Not provided'}</div>
                  <div>Address: {profile?.address || 'Not provided'}</div>
                </div>
              </div>

              <h5 style={{ margin: '16px 0 8px 0', fontSize: '14px', color: '#172B4D' }}>
                Associated Cases Managed by You ({profile?.cases?.length || 0})
              </h5>
              {profile?.cases && profile.cases.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profile.cases.map((c) => (
                    <div key={c.case_id} style={{ padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{c.case_number}</strong>
                        <span className="badge-type">{c.case_type}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>{c.title}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: '#94A3B8' }}>No cases currently associated with this client.</p>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary-action" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function EditClientModal({ clientData, csrfToken, onClose, onSuccess }) {
  const [phone, setPhone] = useState(clientData.phone || '');
  const [address, setAddress] = useState(clientData.address || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/advocate/clients/${clientData.client_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          phone: phone.trim(),
          address: address.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setErrorMsg(data.error || 'Failed to update client.');
      }
    } catch (err) {
      setErrorMsg('Network error saving changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Edit Client: {clientData.full_name}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div className="banner-message error">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group-workflow">
              <label>Contact Phone</label>
              <input
                type="text"
                className="form-input-workflow"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-group-workflow">
              <label>Address</label>
              <textarea
                className="form-textarea-workflow"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary-action" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action" disabled={submitting}>
              {submitting ? 'Updating...' : 'Save Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleHearingModal({ cases, csrfToken, onClose, onSuccess }) {
  const [caseId, setCaseId] = useState(cases && cases.length > 0 ? cases[0].case_id : '');
  const [hearingDate, setHearingDate] = useState('');
  const [courtName, setCourtName] = useState('District & Sessions Court');
  const [courtRoom, setCourtRoom] = useState('Court Hall 2');
  const [judgeName, setJudgeName] = useState('Hon. Presiding Judge');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('SCHEDULED');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!caseId) {
      setErrorMsg('Please select a case matter.');
      return;
    }
    if (!hearingDate) {
      setErrorMsg('Please provide hearing date and appearance time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/advocate/hearings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          case_id: parseInt(caseId, 10),
          hearing_date: hearingDate,
          court_name: courtName.trim(),
          court_room: courtRoom.trim(),
          judge_name: judgeName.trim(),
          notes: notes.trim(),
          hearing_status: status
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setErrorMsg(data.error || 'Failed to schedule hearing.');
      }
    } catch (err) {
      setErrorMsg('Network error scheduling appearance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#B99A5B" />
            <h3 style={{ margin: 0 }}>Schedule Court Appearance</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {errorMsg && (
              <div className="banner-message error">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group-workflow">
              <label>Select Case Matter *</label>
              <select
                className="form-select-workflow"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                required
              >
                <option value="">-- Choose Active Case --</option>
                {cases && cases.map((c) => (
                  <option key={c.case_id} value={c.case_id}>
                    {c.case_number} - {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group-workflow">
              <label>Hearing Date & Appearance Time *</label>
              <input
                type="datetime-local"
                className="form-input-workflow"
                value={hearingDate}
                onChange={(e) => setHearingDate(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group-workflow">
                <label>Court / Forum</label>
                <input
                  type="text"
                  className="form-input-workflow"
                  placeholder="e.g. High Court of Delhi"
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                />
              </div>
              <div className="form-group-workflow">
                <label>Court Hall / Room</label>
                <input
                  type="text"
                  className="form-input-workflow"
                  placeholder="e.g. Courtroom 4"
                  value={courtRoom}
                  onChange={(e) => setCourtRoom(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group-workflow">
              <label>Presiding Judge / Bench</label>
              <input
                type="text"
                className="form-input-workflow"
                placeholder="e.g. Hon. Justice R. K. Bansal"
                value={judgeName}
                onChange={(e) => setJudgeName(e.target.value)}
              />
            </div>

            <div className="form-group-workflow">
              <label>Hearing Agenda & Strategy Notes</label>
              <textarea
                className="form-textarea-workflow"
                placeholder="Arguments agenda, citations to submit, interim relief prayers..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary-action" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action" disabled={submitting}>
              {submitting ? 'Registering...' : 'Add to Cause List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentPreviewModal({ previewData, loading, onClose }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog" style={{ maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#2563EB" />
            <h3 style={{ margin: 0, fontSize: '16px' }}>
              {previewData?.document_title || previewData?.file_name || 'Document Preview'}
            </h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', display: 'block', color: '#B99A5B' }} />
              Extracting document text preview...
            </div>
          ) : previewData?.error ? (
            <div className="banner-message error">
              <AlertTriangle size={16} />
              <span>{previewData.error}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <span style={{ color: '#64748B' }}>Case Matter: </span>
                  <strong style={{ color: '#172B4D' }}>{previewData?.case_number}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>File: </span>
                  <code style={{ color: '#172B4D' }}>{previewData?.file_name}</code>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Size: </span>
                  <span>{previewData?.size_bytes ? `${(previewData.size_bytes / 1024).toFixed(1)} KB` : 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Uploaded By: </span>
                  <span>{previewData?.uploaded_by_name}</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  Extracted Text Preview
                </label>
                <div style={{
                  background: '#1E293B',
                  color: '#F8FAFC',
                  padding: '16px',
                  borderRadius: '8px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  maxHeight: '360px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {previewData?.preview_text || 'No text content available.'}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {previewData?.download_url ? (
            <a
              href={previewData.download_url}
              className="btn-primary-action"
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Download File</span>
            </a>
          ) : <div />}
          <button type="button" className="btn-secondary-action" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DocumentSummaryModal({
  summaryDoc,
  summaryData,
  summaryLoading,
  summaryGenerating,
  summaryError,
  selectedPreferenceId,
  setSelectedPreferenceId,
  savingPreference,
  summaryViewMode,
  setSummaryViewMode,
  onGenerateSummary,
  onSelectPreference,
  onClose
}) {
  const currentPreference = summaryData?.preferences?.find(p => p.id === selectedPreferenceId) || summaryData?.preferences?.[0];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog" style={{ maxWidth: '840px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#D97706" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#172B4D' }}>
                AI Legal Brief: {summaryDoc?.document_title || summaryDoc?.file_name}
              </h3>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                Matter: {summaryDoc?.case_number} • Grok LLM Research Engine
              </div>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {summaryError && (
            <div className="banner-message error" style={{ marginBottom: '14px' }}>
              <AlertTriangle size={16} />
              <span>{summaryError}</span>
            </div>
          )}

          {summaryLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 16px', color: '#64748B' }}>
              <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: '#B99A5B' }} />
              Retrieving stored legal brief...
            </div>
          ) : !summaryData ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
              <Sparkles size={36} color="#B99A5B" style={{ margin: '0 auto 12px', display: 'block' }} />
              <h4 style={{ margin: '0 0 6px 0', color: '#172B4D' }}>No AI Brief Generated Yet</h4>
              <p style={{ margin: '0 0 16px 0', color: '#64748B', fontSize: '13px', maxWidth: '420px', marginInline: 'auto' }}>
                Synthesize a comprehensive legal brief with key deadlines, risks, parties, and advocate strategy using CaseBook's Legal Intelligence Engine.
              </p>
              <button
                type="button"
                className="btn-primary-action"
                onClick={() => onGenerateSummary(false)}
                disabled={summaryGenerating}
                style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px' }}
              >
                {summaryGenerating ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Analyzing Legal Exhibits...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Generate Dual AI Briefs</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Dual Preference Selector */}
              {summaryData.preferences && summaryData.preferences.length > 0 && (
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} color="#D97706" />
                      <span>Choose Official Legal Perspective:</span>
                    </div>
                    <button
                      type="button"
                      className="btn-table-action"
                      onClick={() => onSelectPreference(selectedPreferenceId)}
                      disabled={savingPreference || summaryData.active_preference_id === selectedPreferenceId}
                      style={{
                        fontSize: '12px',
                        padding: '5px 12px',
                        background: summaryData.active_preference_id === selectedPreferenceId ? '#ECFDF5' : '#172B4D',
                        color: summaryData.active_preference_id === selectedPreferenceId ? '#065F46' : '#FFFFFF',
                        border: summaryData.active_preference_id === selectedPreferenceId ? '1px solid #A7F3D0' : 'none',
                        cursor: summaryData.active_preference_id === selectedPreferenceId ? 'default' : 'pointer'
                      }}
                    >
                      {summaryData.active_preference_id === selectedPreferenceId ? (
                        <>
                          <Check size={13} color="#059669" />
                          <span>Official Case Brief</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Set as Official Brief</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
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
                            padding: '10px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#1E40AF' : '#1E293B' }}>
                              {pref.label || pref.id}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                              Perspective: <span style={{ color: '#B99A5B', fontWeight: 600 }}>{pref.perspective || 'Standard'}</span>
                            </div>
                          </div>
                          <div>
                            {isOfficial ? (
                              <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Check size={11} /> Official
                              </span>
                            ) : isSelected ? (
                              <span style={{ background: '#DBEAFE', color: '#1E40AF', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                Selected
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Select</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View Mode Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSummaryViewMode('sections')}
                    style={{
                      background: summaryViewMode === 'sections' ? '#172B4D' : '#F1F5F9',
                      color: summaryViewMode === 'sections' ? '#FFFFFF' : '#475569',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Structured Brief Sections
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryViewMode('raw')}
                    style={{
                      background: summaryViewMode === 'raw' ? '#172B4D' : '#F1F5F9',
                      color: summaryViewMode === 'raw' ? '#FFFFFF' : '#475569',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Full Brief Text
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => onGenerateSummary(true)}
                  disabled={summaryGenerating}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  <RefreshCw size={12} className={summaryGenerating ? 'spin' : ''} />
                  <span>{summaryGenerating ? 'Regenerating...' : 'Regenerate Brief'}</span>
                </button>
              </div>

              {/* Content Render */}
              {summaryViewMode === 'sections' && (currentPreference?.structured_sections || summaryData.structured_sections) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(currentPreference?.structured_sections || summaryData.structured_sections).map(([title, content], idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        background: '#FFFFFF'
                      }}
                    >
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#172B4D', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#B99A5B' }} />
                        {title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '16px',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#1E293B',
                  whiteSpace: 'pre-wrap'
                }}>
                  {currentPreference?.summary_text || summaryData.summary_text}
                </div>
              )}

              {/* Mandatory Legal Disclaimer */}
              <div style={{
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '11px',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Info size={16} style={{ flexShrink: 0 }} />
                <span>{summaryData.disclaimer || 'AI-generated summary for research assistance only. Verify all legal citations against official court records.'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary-action" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
