import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Scale,
  LayoutDashboard,
  Briefcase,
  Calendar,
  FileText,
  User,
  LogOut,
  Bell,
  Search,
  Filter,
  Eye,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Clock,
  X,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Menu,
  Download,
  Trash2,
  Upload,
  CheckCircle2,
  Sparkles,
  FileUp,
  MessageSquare,
  Send,
  Building,
  ChevronRight,
  ExternalLink,
  Info,
  HelpCircle,
  FileCheck,
  Check,
  FolderOpen,
  UserCheck
} from 'lucide-react';
import '../styles/Dashboard.css';

export default function ClientDashboard() {
  const { user, logout, csrfToken } = useAuth();

  // Navigation state
  const [activeNav, setActiveNav] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Global Feedback Banner
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 6000);
  };

  // Helper date formatter
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // ==========================================================================
  // 1. DASHBOARD OVERVIEW STATE & LOGIC
  // ==========================================================================
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch('/api/client/overview', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setOverviewData(data);
      } else {
        setOverviewError(data.error || 'Failed to retrieve overview data.');
      }
    } catch (err) {
      setOverviewError('Could not connect to the client portal. Please check your network connection.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // ==========================================================================
  // 2. MY CASES STATE & LOGIC
  // ==========================================================================
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState(null);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState('ALL');
  const [caseTypeFilter, setCaseTypeFilter] = useState('ALL');
  const [casesViewMode, setCasesViewMode] = useState('table'); // 'table' | 'cards'

  // Case Details Modal
  const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [caseModalTab, setCaseModalTab] = useState('overview'); // 'overview' | 'hearings' | 'documents' | 'inquiries'

  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      const params = new URLSearchParams();
      if (caseSearch.trim()) params.append('q', caseSearch.trim());
      if (caseStatusFilter !== 'ALL') params.append('status', caseStatusFilter);
      if (caseTypeFilter !== 'ALL') params.append('type', caseTypeFilter);

      const res = await fetch(`/api/client/cases?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setCases(data.cases || []);
      } else {
        setCasesError(data.error || 'Failed to retrieve cases.');
      }
    } catch (err) {
      setCasesError('Error loading case ledger.');
    } finally {
      setCasesLoading(false);
    }
  }, [caseSearch, caseStatusFilter, caseTypeFilter]);

  useEffect(() => {
    if (activeNav === 'cases' || activeNav === 'overview' || activeNav === 'documents' || activeNav === 'contact') {
      fetchCases();
    }
  }, [activeNav, fetchCases]);

  const openCaseDetails = async (caseId) => {
    setShowCaseModal(true);
    setCaseDetailLoading(true);
    setSelectedCaseDetail(null);
    setCaseModalTab('overview');
    try {
      const res = await fetch(`/api/client/cases/${caseId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setSelectedCaseDetail(data.case);
      } else {
        showFeedback('error', data.error || 'Failed to open case file.');
        setShowCaseModal(false);
      }
    } catch {
      showFeedback('error', 'Error retrieving case details. Please try again.');
      setShowCaseModal(false);
    } finally {
      setCaseDetailLoading(false);
    }
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchSearch =
        !caseSearch.trim() ||
        c.case_number.toLowerCase().includes(caseSearch.toLowerCase()) ||
        c.title.toLowerCase().includes(caseSearch.toLowerCase()) ||
        c.advocate_name.toLowerCase().includes(caseSearch.toLowerCase());
      const matchStatus = caseStatusFilter === 'ALL' || c.case_status.toUpperCase() === caseStatusFilter;
      const matchType = caseTypeFilter === 'ALL' || c.case_type.toUpperCase() === caseTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [cases, caseSearch, caseStatusFilter, caseTypeFilter]);

  // ==========================================================================
  // 3. MY DOCUMENTS STATE & LOGIC
  // ==========================================================================
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(null);
  const [docSearch, setDocSearch] = useState('');
  const [docCaseFilter, setDocCaseFilter] = useState('ALL');

  // Upload Form State
  const [uploadCaseId, setUploadCaseId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Eligible Staff State for Selected Case (Required Staff Selection)
  const [eligibleStaff, setEligibleStaff] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState(null);

  useEffect(() => {
    if (!uploadCaseId) {
      setEligibleStaff([]);
      setSelectedStaffId('');
      setStaffError(null);
      return;
    }

    let isMounted = true;
    const fetchEligibleStaff = async () => {
      setLoadingStaff(true);
      setStaffError(null);
      setSelectedStaffId('');
      try {
        const res = await fetch(`/api/client/cases/${uploadCaseId}/eligible-staff`, { credentials: 'include' });
        const data = await res.json();
        if (!isMounted) return;
        if (res.ok) {
          const list = data.staff_members || [];
          setEligibleStaff(list);
          if (list.length === 1) {
            setSelectedStaffId(String(list[0].staff_id));
          }
        } else {
          setStaffError(data.error || 'Unable to retrieve assigned legal staff for this matter.');
          setEligibleStaff([]);
        }
      } catch {
        if (isMounted) {
          setStaffError('Connection error loading case staff members.');
          setEligibleStaff([]);
        }
      } finally {
        if (isMounted) setLoadingStaff(false);
      }
    };

    fetchEligibleStaff();
    return () => { isMounted = false; };
  }, [uploadCaseId]);

  const selectedStaffMember = useMemo(() => {
    if (!selectedStaffId) return null;
    return eligibleStaff.find((s) => String(s.staff_id) === String(selectedStaffId)) || null;
  }, [eligibleStaff, selectedStaffId]);

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // AI Summary Modal State (Client-Safe)
  const [summaryDoc, setSummaryDoc] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Delete Confirm Modal State
  const [docToDelete, setDocToDelete] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const params = new URLSearchParams();
      if (docSearch.trim()) params.append('q', docSearch.trim());
      if (docCaseFilter !== 'ALL') params.append('case_id', docCaseFilter);

      const res = await fetch(`/api/client/documents?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      } else {
        setDocsError(data.error || 'Failed to retrieve documents.');
      }
    } catch {
      setDocsError('Error connecting to document repository.');
    } finally {
      setDocsLoading(false);
    }
  }, [docSearch, docCaseFilter]);

  useEffect(() => {
    if (activeNav === 'documents' || activeNav === 'overview') {
      fetchDocuments();
    }
  }, [activeNav, fetchDocuments]);

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const fileName = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidExt) {
      showFeedback('error', 'Unsupported format. Only PDF (.pdf), Word (.docx), and Plain Text (.txt) files are permitted.');
      setSelectedFile(null);
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      showFeedback('error', 'File size exceeds 16 MB limit. Please select a compressed legal document.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!uploadTitle.trim()) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // Handle Document Upload Submit
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showFeedback('error', 'Please select a document file to upload.');
      return;
    }
    if (!uploadCaseId) {
      showFeedback('error', 'Please select the associated case matter.');
      return;
    }
    if (!selectedStaffId) {
      showFeedback('error', 'Assign Document to Staff is required. Please select an authorized staff member.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadTitle.trim());
    formData.append('description', uploadDesc.trim());
    formData.append('assigned_staff_id', selectedStaffId);

    try {
      const headers = {};
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch(`/api/client/cases/${uploadCaseId}/documents/upload`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback(
          'success',
          `Document "${selectedFile.name}" successfully uploaded and assigned to ${data.document?.assigned_staff_name || 'selected staff'} for analysis.`
        );
        setSelectedFile(null);
        setUploadTitle('');
        setUploadDesc('');
        setSelectedStaffId('');
        const fileInput = document.getElementById('client-file-input');
        if (fileInput) fileInput.value = '';
        fetchDocuments();
        fetchOverview();
      } else {
        showFeedback('error', data.error || 'Failed to upload document.');
      }
    } catch {
      showFeedback('error', 'Network error during upload. Please verify your connection.');
    } finally {
      setUploading(false);
    }
  };

  // Handle Document Preview
  const handlePreviewDocument = async (doc) => {
    setPreviewDoc(doc);
    setShowPreviewModal(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/client/documents/${doc.document_id}/preview`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setPreviewDoc(data);
      } else {
        showFeedback('error', data.error || 'Could not load document preview.');
      }
    } catch {
      showFeedback('error', 'Failed to retrieve document preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle AI Summary Inspection (Client-Approved)
  const handleViewSummary = async (doc) => {
    setSummaryDoc(doc);
    setShowSummaryModal(true);
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await fetch(`/api/client/documents/${doc.document_id}/summary`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setSummaryData(data);
      } else {
        showFeedback('error', data.error || 'Could not retrieve document summary.');
      }
    } catch {
      showFeedback('error', 'Failed to connect to summary service.');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Handle Document Deletion (Permitted only if client uploaded)
  const handleExecuteDeleteDoc = async () => {
    if (!docToDelete) return;
    setDeletingDoc(true);
    try {
      const headers = {};
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch(`/api/client/documents/${docToDelete.document_id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback('success', data.message || 'Document deleted successfully.');
        setDocToDelete(null);
        fetchDocuments();
        fetchOverview();
      } else {
        showFeedback('error', data.error || 'Failed to delete document.');
      }
    } catch {
      showFeedback('error', 'Error requesting document deletion.');
    } finally {
      setDeletingDoc(false);
    }
  };

  // ==========================================================================
  // 4. HEARINGS & DEADLINES STATE & LOGIC
  // ==========================================================================
  const [hearings, setHearings] = useState([]);
  const [hearingsLoading, setHearingsLoading] = useState(false);
  const [hearingsError, setHearingsError] = useState(null);
  const [hearingFilter, setHearingFilter] = useState('ALL'); // 'ALL' | 'UPCOMING' | 'PAST'

  const fetchHearings = useCallback(async () => {
    setHearingsLoading(true);
    setHearingsError(null);
    try {
      const res = await fetch('/api/client/hearings', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setHearings(data.hearings || []);
      } else {
        setHearingsError(data.error || 'Failed to retrieve hearings cause list.');
      }
    } catch {
      setHearingsError('Error loading court schedule.');
    } finally {
      setHearingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeNav === 'hearings') {
      fetchHearings();
    }
  }, [activeNav, fetchHearings]);

  const filteredHearings = useMemo(() => {
    const now = new Date();
    return hearings.filter((h) => {
      const hDate = new Date(h.hearing_date);
      if (hearingFilter === 'UPCOMING') return hDate >= now;
      if (hearingFilter === 'PAST') return hDate < now;
      return true;
    });
  }, [hearings, hearingFilter]);

  // ==========================================================================
  // 5. CONTACT ADVOCATE & INQUIRY WORKFLOW
  // ==========================================================================
  const [advocates, setAdvocates] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);

  // Inquiry Form State
  const [inquiryCaseId, setInquiryCaseId] = useState('');
  const [inquirySubject, setInquirySubject] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  const fetchAdvocatesAndInquiries = useCallback(async () => {
    setInquiriesLoading(true);
    try {
      const [resAdv, resInq] = await Promise.all([
        fetch('/api/client/advocates', { credentials: 'include' }),
        fetch('/api/client/inquiries', { credentials: 'include' })
      ]);
      const dataAdv = await resAdv.json();
      const dataInq = await resInq.json();
      if (resAdv.ok) setAdvocates(dataAdv.advocates || []);
      if (resInq.ok) setInquiries(dataInq.inquiries || []);
    } catch {
      // Handled silently
    } finally {
      setInquiriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeNav === 'contact') {
      fetchAdvocatesAndInquiries();
    }
  }, [activeNav, fetchAdvocatesAndInquiries]);

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    if (!inquiryCaseId) {
      showFeedback('error', 'Please select the case you are inquiring about.');
      return;
    }
    if (!inquirySubject.trim()) {
      showFeedback('error', 'Please enter a subject for your legal inquiry.');
      return;
    }
    if (!inquiryMessage.trim() || inquiryMessage.trim().length < 10) {
      showFeedback('error', 'Please provide detailed questions or notes for counsel (minimum 10 characters).');
      return;
    }

    setSubmittingInquiry(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch('/api/client/inquiries', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          case_id: inquiryCaseId,
          subject: inquirySubject.trim(),
          message_text: inquiryMessage.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback('success', 'Your inquiry has been submitted to your assigned advocate.');
        setInquirySubject('');
        setInquiryMessage('');
        fetchAdvocatesAndInquiries();
      } else {
        showFeedback('error', data.error || 'Failed to submit inquiry.');
      }
    } catch {
      showFeedback('error', 'Error connecting to server. Please check your connection.');
    } finally {
      setSubmittingInquiry(false);
    }
  };

  // Pre-select first case if upload/inquiry case id is empty
  useEffect(() => {
    if (cases.length > 0) {
      if (!uploadCaseId) setUploadCaseId(cases[0].case_id);
      if (!inquiryCaseId) setInquiryCaseId(cases[0].case_id);
      if (docCaseFilter === 'ALL' && cases.length === 1) setDocCaseFilter(cases[0].case_id);
    }
  }, [cases, uploadCaseId, inquiryCaseId, docCaseFilter]);

  // ==========================================================================
  // RENDER MAIN APPLICATION
  // ==========================================================================
  return (
    <div className="dashboard-layout">
      {/* ------------------------------------------------------------ */}
      {/* 1. SIDEBAR NAVIGATION                                        */}
      {/* ------------------------------------------------------------ */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Scale size={20} strokeWidth={2.2} />
          </div>
          <div className="brand-details">
            <span className="brand-name">Legal CaseBook</span>
            <span className="brand-portal-tag" style={{ color: '#B99A5B', fontSize: '11px', fontWeight: 700, letterSpacing: '0.4px' }}>
              CLIENT PORTAL
            </span>
          </div>
        </div>

        <div className="sidebar-nav-container">
          <div className="sidebar-nav-group-title">Litigation Center</div>
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'overview' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('overview');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><LayoutDashboard size={18} /></span>
                <span>Dashboard Overview</span>
              </button>
            </li>

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
                <span>My Cases</span>
                {overviewData?.metrics?.total_cases > 0 && (
                  <span className="sidebar-nav-badge">{overviewData.metrics.total_cases}</span>
                )}
              </button>
            </li>

            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'documents' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('documents');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><FileText size={18} /></span>
                <span>My Documents</span>
                {overviewData?.metrics?.total_documents > 0 && (
                  <span className="sidebar-nav-badge">{overviewData.metrics.total_documents}</span>
                )}
              </button>
            </li>

            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'hearings' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('hearings');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><Calendar size={18} /></span>
                <span>Hearings & Cause List</span>
                {overviewData?.metrics?.upcoming_hearings > 0 && (
                  <span className="sidebar-nav-badge urgency-badge" style={{ background: '#FAF6EF', color: '#B99A5B' }}>
                    {overviewData.metrics.upcoming_hearings}
                  </span>
                )}
              </button>
            </li>

            <li className="sidebar-nav-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${activeNav === 'contact' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('contact');
                  setMobileMenuOpen(false);
                }}
              >
                <span className="sidebar-nav-icon"><MessageSquare size={18} /></span>
                <span>Contact Advocate</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-nav-group-title">Account & Credentials</div>
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
            title="Sign out of portal"
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
                {activeNav === 'overview' && 'Client Dashboard Overview'}
                {activeNav === 'cases' && 'My Authorized Matters'}
                {activeNav === 'documents' && 'Privileged Documents & Filings'}
                {activeNav === 'hearings' && 'Hearings & Court Cause List'}
                {activeNav === 'contact' && 'Contact Assigned Advocate'}
                {activeNav === 'profile' && 'Litigant Credentials & Profile'}
              </h2>
              <span>Client Portal Connected • Encrypted TLS Session</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Notification Bell with Popover */}
            <div className="topbar-notifications">
              <button
                type="button"
                className="btn-icon-notify"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="View notifications"
              >
                <Bell size={18} />
                {(overviewData?.metrics?.upcoming_hearings > 0) && (
                  <span className="notify-badge-dot" />
                )}
              </button>

              {showNotifications && (
                <div className="notify-popover">
                  <div className="notify-popover-header">
                    <h4>Litigation Notifications</h4>
                    <span style={{ fontSize: '11px', color: '#B99A5B', fontWeight: 600 }}>Active Portal</span>
                  </div>
                  <div className="notify-popover-list">
                    <div className="notify-item">
                      <strong>Client Authorization Active</strong>
                      <p style={{ margin: '2px 0 0 0' }}>Access granted to your registered legal proceedings.</p>
                      <div className="notify-item-time">Session Verified</div>
                    </div>
                    {overviewData?.metrics?.upcoming_hearings > 0 && (
                      <div className="notify-item">
                        <strong>Upcoming Cause List Hearing</strong>
                        <p style={{ margin: '2px 0 0 0' }}>
                          You have {overviewData.metrics.upcoming_hearings} upcoming court appearance(s) scheduled.
                        </p>
                        <div className="notify-item-time">Action Scheduled</div>
                      </div>
                    )}
                    {overviewData?.metrics?.total_documents > 0 && (
                      <div className="notify-item">
                        <strong>Document Repository Ready</strong>
                        <p style={{ margin: '2px 0 0 0' }}>
                          {overviewData.metrics.total_documents} legal file(s) available for secure preview and download.
                        </p>
                        <div className="notify-item-time">Repository Active</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Identity Chip */}
            <div
              className="topbar-profile-chip"
              onClick={() => setActiveNav('profile')}
              style={{ cursor: 'pointer' }}
              title="View Client Profile"
            >
              <div className="profile-avatar-circle" aria-hidden="true" style={{ background: '#172B4D', color: '#B99A5B', fontWeight: 700 }}>
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div className="profile-meta">
                <span className="profile-name">{user?.full_name || 'Client'}</span>
                <span className="profile-badge-tag" style={{ background: '#FAF6EF', color: '#B99A5B' }}>
                  Verified Litigant
                </span>
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
          <div
            className={`feedback-banner ${feedback.type === 'success' ? 'success' : 'error'}`}
            role="alert"
            style={{ margin: '20px 32px 0 32px' }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback({ type: '', message: '' })}
              style={{ background: 'none', border: 'none', marginLeft: 'auto', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Dynamic Main Workspace Container */}
        <main className="dashboard-content" role="main" style={{ padding: '24px 32px 48px 32px' }}>
          {/* ========================================================== */}
          {/* VIEW 1: DASHBOARD OVERVIEW                                 */}
          {/* ========================================================== */}
          {activeNav === 'overview' && (
            <div className="workspace-tab-content">
              {/* Hero Welcome Banner */}
              <div className="dashboard-hero-banner" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '28px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#FAF6EF', border: '1px solid #E8DCC4', color: '#B99A5B', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>
                    <ShieldCheck size={14} />
                    <span>CLIENT LITIGATION PORTAL • ADVOCATE CASEBOOK</span>
                  </div>
                  <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#172B4D', margin: '0 0 8px 0', letterSpacing: '-0.4px' }}>
                    Welcome back, {user?.full_name || 'Client'}
                  </h1>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px', maxWidth: '640px', lineHeight: 1.5 }}>
                    Access your authorized court proceedings, inspect upcoming hearing cause lists,
                    upload certified pleadings, and communicate with your assigned advocate.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-md"
                    onClick={() => setActiveNav('documents')}
                  >
                    <Upload size={15} />
                    <span>Upload Document</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-md"
                    onClick={() => setActiveNav('contact')}
                  >
                    <MessageSquare size={15} />
                    <span>Contact Advocate</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Metric Cards */}
              <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {/* 1. Total Cases */}
                <div className="metric-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(23,43,77,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>My Total Cases</span>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#F4F6F9', color: '#172B4D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Briefcase size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#172B4D' }}>
                    {overviewLoading ? <RefreshCw size={22} className="btn-spinner" /> : overviewData?.metrics?.total_cases ?? 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>Authorized matters on record</div>
                </div>

                {/* 2. Active Cases */}
                <div className="metric-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(23,43,77,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Active Proceedings</span>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderOpen size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>
                    {overviewLoading ? <RefreshCw size={22} className="btn-spinner" /> : overviewData?.metrics?.active_cases ?? 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>Open or in-progress litigation</div>
                </div>

                {/* 3. Documents Uploaded */}
                <div className="metric-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(23,43,77,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Documents Uploaded</span>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#F4F6F9', color: '#172B4D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#172B4D' }}>
                    {overviewLoading ? <RefreshCw size={22} className="btn-spinner" /> : overviewData?.metrics?.total_documents ?? 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>Evidence, petitions & orders</div>
                </div>

                {/* 4. Upcoming Hearings */}
                <div className="metric-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(23,43,77,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Upcoming Hearings</span>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FAF6EF', color: '#B99A5B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#B99A5B' }}>
                    {overviewLoading ? <RefreshCw size={22} className="btn-spinner" /> : overviewData?.metrics?.upcoming_hearings ?? 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>Scheduled cause list dates</div>
                </div>
              </div>

              {/* 2-Column Section: Recent Authorized Matters & Next Court Hearings */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '28px' }}>
                {/* Recent Cases Card */}
                <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D', margin: 0 }}>Recent Matters</h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Cases authorized for your client account</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveNav('cases')}
                    >
                      <span>View All</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  {overviewLoading ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                      <RefreshCw size={22} className="btn-spinner" style={{ margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, fontSize: '13px' }}>Loading your cases...</p>
                    </div>
                  ) : overviewData?.recent_cases?.length === 0 ? (
                    <div className="empty-state-box" style={{ padding: '32px 16px', textAlign: 'center' }}>
                      <Briefcase size={36} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                      <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#172B4D' }}>No Cases Assigned Yet</h4>
                      <p style={{ margin: 0, fontSize: '12.5px', color: '#64748B' }}>Your advocate will register proceedings to your account.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="legal-data-table">
                        <thead>
                          <tr>
                            <th>Case Reference</th>
                            <th>Status</th>
                            <th>Supervising Counsel</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData?.recent_cases?.map((c) => (
                            <tr key={c.case_id}>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#172B4D', fontSize: '13px' }}>
                                    {c.case_number}
                                  </span>
                                  <span style={{ fontSize: '12px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.title}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={`badge-status ${c.case_status?.toLowerCase() === 'open' ? 'open' : ''}`}>
                                  {c.case_status}
                                </span>
                              </td>
                              <td style={{ fontSize: '13px', color: '#172B4D' }}>{c.advocate_name}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => openCaseDetails(c.case_id)}
                                >
                                  <Eye size={12} />
                                  <span>View Case</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Upcoming Hearings Card */}
                <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D', margin: 0 }}>Upcoming Court Cause List</h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Next scheduled hearings and appearances</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveNav('hearings')}
                    >
                      <span>Full Schedule</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  {overviewLoading ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                      <RefreshCw size={22} className="btn-spinner" style={{ margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, fontSize: '13px' }}>Loading hearings schedule...</p>
                    </div>
                  ) : overviewData?.upcoming_hearings_list?.length === 0 ? (
                    <div className="empty-state-box" style={{ padding: '32px 16px', textAlign: 'center' }}>
                      <Calendar size={36} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                      <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#172B4D' }}>No Upcoming Hearings Scheduled</h4>
                      <p style={{ margin: 0, fontSize: '12.5px', color: '#64748B' }}>Scheduled court appearances will appear here.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {overviewData?.upcoming_hearings_list?.map((h) => (
                        <div
                          key={h.hearing_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px',
                            background: '#F8FAFC',
                            border: '1px solid #E5E9F0',
                            borderRadius: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E5E9F0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <Calendar size={16} color="#B99A5B" />
                            </div>
                            <div>
                              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#172B4D' }}>
                                {formatDateTime(h.hearing_date)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>
                                Case: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{h.case_number}</span> • {h.court_room}
                              </div>
                            </div>
                          </div>

                          <span className="badge-tag" style={{ background: '#FAF6EF', color: '#B99A5B', border: '1px solid #E8DCC4' }}>
                            {h.hearing_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 2: MY CASES                                          */}
          {/* ========================================================== */}
          {activeNav === 'cases' && (
            <div className="workspace-tab-content">
              {/* Header & Filter Controls */}
              <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '22px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '0 0 4px 0' }}>
                      My Authorized Cases
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                      Official litigation proceedings registered to your client identity.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <button
                        type="button"
                        onClick={() => setCasesViewMode('table')}
                        style={{
                          background: casesViewMode === 'table' ? '#FFFFFF' : 'transparent',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#172B4D',
                          cursor: 'pointer',
                          boxShadow: casesViewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                        }}
                      >
                        Table
                      </button>
                      <button
                        type="button"
                        onClick={() => setCasesViewMode('cards')}
                        style={{
                          background: casesViewMode === 'cards' ? '#FFFFFF' : 'transparent',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#172B4D',
                          cursor: 'pointer',
                          boxShadow: casesViewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                        }}
                      >
                        Cards
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={fetchCases}
                      title="Refresh Cases"
                    >
                      <RefreshCw size={13} className={casesLoading ? 'btn-spinner' : ''} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
                    <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: '100%', paddingLeft: '36px', height: '38px', borderRadius: '8px', border: '1px solid #E5E9F0', fontSize: '13px' }}
                      placeholder="Search by case title, case number, or advocate..."
                      value={caseSearch}
                      onChange={(e) => setCaseSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="select-filter"
                    style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E9F0', fontSize: '13px' }}
                    value={caseStatusFilter}
                    onChange={(e) => setCaseStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="CLOSED">Closed</option>
                  </select>

                  <select
                    className="select-filter"
                    style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E9F0', fontSize: '13px' }}
                    value={caseTypeFilter}
                    onChange={(e) => setCaseTypeFilter(e.target.value)}
                  >
                    <option value="ALL">All Case Types</option>
                    <option value="CIVIL">Civil</option>
                    <option value="CRIMINAL">Criminal</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="CONSTITUTIONAL">Constitutional</option>
                  </select>
                </div>
              </div>

              {/* Cases Listing */}
              {casesLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={28} className="btn-spinner" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>Loading case files...</p>
                </div>
              ) : casesError ? (
                <div className="feedback-banner error" role="alert">
                  <AlertTriangle size={18} />
                  <span>{casesError}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={fetchCases}>Retry</button>
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '60px 24px', textAlign: 'center' }}>
                  <Briefcase size={48} color="#CBD5E1" style={{ margin: '0 auto 14px' }} />
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>No Matching Cases Found</h3>
                  <p style={{ fontSize: '13.5px', color: '#64748B', maxWidth: '420px', margin: '0 auto' }}>
                    {caseSearch || caseStatusFilter !== 'ALL' || caseTypeFilter !== 'ALL'
                      ? 'No legal matters match your current filters. Try resetting search criteria.'
                      : 'You do not have any registered case proceedings at this time.'}
                  </p>
                </div>
              ) : casesViewMode === 'table' ? (
                /* Table View */
                <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '24px' }}>
                  <div className="table-responsive">
                    <table className="legal-data-table">
                      <thead>
                        <tr>
                          <th>Case Reference</th>
                          <th>Case Title & Details</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Supervising Counsel</th>
                          <th>Next Hearing</th>
                          <th>Docs</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCases.map((c) => (
                          <tr key={c.case_id}>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#172B4D', fontSize: '13px', background: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                                {c.case_number}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '14px', marginBottom: '2px' }}>
                                {c.title}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.description || 'Pleadings & legal defense on record.'}
                              </div>
                            </td>
                            <td><span className="badge-type">{c.case_type}</span></td>
                            <td><span className={`badge-status ${c.case_status?.toLowerCase() === 'open' ? 'open' : ''}`}>{c.case_status}</span></td>
                            <td>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D' }}>{c.advocate_name}</div>
                              <div style={{ fontSize: '11.5px', color: '#64748B' }}>{c.assigned_staff_name}</div>
                            </td>
                            <td>
                              {c.next_hearing_date ? (
                                <div style={{ fontSize: '12.5px', color: '#B99A5B', fontWeight: 600 }}>
                                  {formatDate(c.next_hearing_date)}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Awaiting Cause List</span>
                              )}
                            </td>
                            <td>
                              <span className="badge-tag">{c.document_count} file(s)</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => openCaseDetails(c.case_id)}
                              >
                                <Eye size={13} />
                                <span>View Case</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Cards View */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                  {filteredCases.map((c) => (
                    <div
                      key={c.case_id}
                      className="dashboard-card"
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E5E9F0',
                        borderRadius: '12px',
                        padding: '22px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#172B4D', fontSize: '13px', background: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                            {c.case_number}
                          </span>
                          <span className={`badge-status ${c.case_status?.toLowerCase() === 'open' ? 'open' : ''}`}>{c.case_status}</span>
                        </div>

                        <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
                          {c.title}
                        </h4>
                        <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                          {c.description || 'Pleadings & legal defense on record.'}
                        </p>

                        <div style={{ background: '#F8FAFC', border: '1px solid #E5E9F0', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>Supervising Advocate:</div>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#172B4D' }}>{c.advocate_name}</div>
                          {c.next_hearing_date && (
                            <div style={{ fontSize: '12px', color: '#B99A5B', fontWeight: 600, marginTop: '4px' }}>
                              Next Hearing: {formatDate(c.next_hearing_date)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E5E9F0', paddingTop: '14px' }}>
                        <span className="badge-type">{c.case_type}</span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => openCaseDetails(c.case_id)}
                        >
                          <Eye size={13} />
                          <span>View Case</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 3: MY DOCUMENTS                                      */}
          {/* ========================================================== */}
          {activeNav === 'documents' && (
            <div className="workspace-tab-content">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '28px', alignItems: 'flex-start' }}>
                {/* Upload Card */}
                <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#F4F6F9', color: '#172B4D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D', margin: 0 }}>
                        Upload Legal Document
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>PDF, DOCX, or TXT up to 16 MB</span>
                    </div>
                  </div>

                  <form onSubmit={handleUploadSubmit}>
                    {/* Case Selector */}
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                        Select Associated Case Matter *
                      </label>
                      <select
                        className="select-filter"
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E5E9F0', fontSize: '13px', fontWeight: 600, color: '#172B4D' }}
                        value={uploadCaseId}
                        onChange={(e) => setUploadCaseId(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Matter --</option>
                        {cases.map((c) => (
                          <option key={c.case_id} value={c.case_id}>
                            {c.case_number} — {c.title.substring(0, 28)}...
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Required: Assign Document to Staff */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#172B4D' }}>
                          Assign Document to Staff *
                        </label>
                        {loadingStaff && (
                          <span style={{ fontSize: '11px', color: '#B99A5B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <RefreshCw size={11} className="btn-spinner" /> Checking authorization...
                          </span>
                        )}
                      </div>

                      <select
                        className="select-filter"
                        style={{
                          width: '100%',
                          height: '38px',
                          borderRadius: '8px',
                          border: selectedStaffId ? '1.5px solid #172B4D' : '1px solid #E5E9F0',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#172B4D',
                          backgroundColor: !uploadCaseId ? '#F8FAFC' : '#FFFFFF'
                        }}
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        disabled={!uploadCaseId || loadingStaff || eligibleStaff.length === 0}
                        required
                      >
                        {!uploadCaseId ? (
                          <option value="">-- Select a Case Matter First --</option>
                        ) : loadingStaff ? (
                          <option value="">Loading authorized legal staff...</option>
                        ) : eligibleStaff.length === 0 ? (
                          <option value="">No authorized staff assigned to this case</option>
                        ) : (
                          <>
                            <option value="">-- Select Staff Member for Document Analysis --</option>
                            {eligibleStaff.map((staff) => (
                              <option key={staff.staff_id} value={staff.staff_id}>
                                {staff.full_name} ({staff.employee_code}) — {staff.role_title}
                              </option>
                            ))}
                          </>
                        )}
                      </select>

                      {/* Warning if no staff assigned to the matter */}
                      {uploadCaseId && !loadingStaff && eligibleStaff.length === 0 && (
                        <div style={{ marginTop: '8px', padding: '8px 12px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '6px', fontSize: '12px', color: '#92400E' }}>
                          No staff members are currently assigned to this case file. Please contact your advocate before uploading.
                        </div>
                      )}

                      {/* Selected Staff Member Professional Details Card */}
                      {selectedStaffMember && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '12px',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: '#172B4D',
                              color: '#B99A5B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '14px',
                              flexShrink: 0
                            }}
                          >
                            {selectedStaffMember.full_name.charAt(0)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: '#172B4D' }}>
                                {selectedStaffMember.full_name}
                              </span>
                              <span
                                style={{
                                  background: '#FAF6EF',
                                  color: '#B99A5B',
                                  border: '1px solid #E8DCC4',
                                  borderRadius: '4px',
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  padding: '1px 6px'
                                }}
                              >
                                {selectedStaffMember.employee_code}
                              </span>
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                              {selectedStaffMember.role_title} • Authorized Legal Delegate
                            </div>
                          </div>
                          <ShieldCheck size={18} color="#059669" title="Authorized Case Delegate" />
                        </div>
                      )}
                    </div>

                    {/* Document Title */}
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                        Document Title *
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E5E9F0', padding: '0 12px', fontSize: '13px' }}
                        placeholder="e.g. Affidavit in Support, Counterpart Agreement"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        required
                      />
                    </div>

                    {/* Optional Description */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                        Description (Optional)
                      </label>
                      <textarea
                        rows={2}
                        className="input-field"
                        style={{ width: '100%', borderRadius: '8px', border: '1px solid #E5E9F0', padding: '8px 12px', fontSize: '13px', resize: 'vertical' }}
                        placeholder="Additional details regarding this evidence or submission..."
                        value={uploadDesc}
                        onChange={(e) => setUploadDesc(e.target.value)}
                      />
                    </div>

                    {/* Dropzone */}
                    <div
                      style={{
                        border: '2px dashed #CBD5E1',
                        borderRadius: '10px',
                        padding: '24px 16px',
                        textAlign: 'center',
                        backgroundColor: selectedFile ? '#F8FAFC' : '#FAFCFE',
                        marginBottom: '18px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <FileUp size={34} color="#B99A5B" style={{ margin: '0 auto 8px' }} />
                      <p style={{ fontSize: '13.5px', fontWeight: 600, color: '#172B4D', margin: '0 0 4px 0' }}>
                        {selectedFile ? selectedFile.name : 'Select legal file to upload'}
                      </p>
                      <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 14px 0' }}>
                        {selectedFile
                          ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                          : 'Supported: PDF (.pdf), Word (.docx), Plain Text (.txt)'}
                      </p>

                      <input
                        type="file"
                        id="client-file-input"
                        accept=".pdf,.docx,.txt"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                      />

                      <label
                        htmlFor="client-file-input"
                        className="btn btn-secondary btn-sm"
                        style={{ cursor: 'pointer' }}
                      >
                        <Upload size={13} />
                        <span>{selectedFile ? 'Choose Another' : 'Browse Files'}</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-md"
                      style={{ width: '100%' }}
                      disabled={!selectedFile || !uploadCaseId || !selectedStaffId || uploading}
                    >
                      {uploading ? (
                        <>
                          <RefreshCw size={15} className="btn-spinner" />
                          <span>Validating & Storing...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={15} />
                          <span>Upload & Assign</span>
                        </>
                      )}
                    </button>

                    <div style={{ marginTop: '14px', fontSize: '11.5px', color: '#64748B', lineHeight: 1.4, textAlign: 'center' }}>
                      <ShieldCheck size={12} color="#B99A5B" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      Encrypted storage with magic bytes integrity checks.
                    </div>
                  </form>
                </div>

                {/* Document Repository List */}
                <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D', margin: 0 }}>
                        Case Document Repository
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        Authorized filings, evidence, and orders for your proceedings
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={fetchDocuments}
                        title="Refresh Documents"
                      >
                        <RefreshCw size={13} className={docsLoading ? 'btn-spinner' : ''} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
                    <div style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
                      <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        className="input-field"
                        style={{ width: '100%', paddingLeft: '34px', height: '36px', borderRadius: '8px', border: '1px solid #E5E9F0', fontSize: '12.5px' }}
                        placeholder="Search document name or case..."
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                      />
                    </div>

                    <select
                      className="select-filter"
                      style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E9F0', fontSize: '12.5px' }}
                      value={docCaseFilter}
                      onChange={(e) => setDocCaseFilter(e.target.value)}
                    >
                      <option value="ALL">All Matters</option>
                      {cases.map((c) => (
                        <option key={c.case_id} value={c.case_id}>
                          {c.case_number}
                        </option>
                      ))}
                    </select>
                  </div>

                  {docsLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                      <RefreshCw size={24} className="btn-spinner" style={{ margin: '0 auto 10px' }} />
                      <p style={{ margin: 0, fontSize: '13.5px' }}>Retrieving case documents...</p>
                    </div>
                  ) : docsError ? (
                    <div className="feedback-banner error" role="alert">
                      <AlertTriangle size={18} />
                      <span>{docsError}</span>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="empty-state-box" style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <FileText size={42} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                      <h4 style={{ margin: '0 0 6px 0', color: '#172B4D', fontSize: '15px' }}>
                        No Documents Uploaded Yet
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                        Use the panel on the left to upload your initial case documents or supporting evidence.
                      </p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="legal-data-table">
                        <thead>
                          <tr>
                            <th>Document Title & File</th>
                            <th>Case Reference</th>
                            <th>Assigned Staff</th>
                            <th>Status</th>
                            <th>Uploaded</th>
                            <th>AI Summary</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.map((doc) => (
                            <tr key={doc.document_id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={16} color="#B99A5B" />
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '13.5px' }}>
                                      {doc.document_title || doc.file_name}
                                    </div>
                                    {doc.document_title && doc.document_title !== doc.file_name && (
                                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                                        {doc.file_name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', color: '#172B4D' }}>
                                  {doc.case_number}
                                </span>
                              </td>
                              <td>
                                {doc.assigned_staff_name ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <UserCheck size={13} color="#B99A5B" />
                                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#172B4D' }}>
                                      {doc.assigned_staff_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                                    Unassigned
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background:
                                      doc.assignment_status === 'ANALYZED'
                                        ? '#ECFDF5'
                                        : doc.assignment_status === 'IN_REVIEW'
                                        ? '#FFFBEB'
                                        : '#EFF6FF',
                                    color:
                                      doc.assignment_status === 'ANALYZED'
                                        ? '#059669'
                                        : doc.assignment_status === 'IN_REVIEW'
                                        ? '#D97706'
                                        : '#2563EB',
                                    border: `1px solid ${
                                      doc.assignment_status === 'ANALYZED'
                                        ? '#A7F3D0'
                                        : doc.assignment_status === 'IN_REVIEW'
                                        ? '#FDE68A'
                                        : '#BFDBFE'
                                    }`
                                  }}
                                >
                                  {doc.assignment_status || 'ASSIGNED'}
                                </span>
                              </td>
                              <td style={{ fontSize: '12.5px', color: '#64748B' }}>
                                {formatDate(doc.uploaded_at)}
                              </td>
                              <td>
                                {doc.has_summary ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewSummary(doc)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      background: '#FAF6EF',
                                      color: '#B99A5B',
                                      border: '1px solid #E8DCC4',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                    title="View verified AI document brief"
                                  >
                                    <Sparkles size={11} />
                                    <span>AI Brief Ready</span>
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                                    Standard Filing
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handlePreviewDocument(doc)}
                                    title="Preview Document Text"
                                  >
                                    <Eye size={12} />
                                    <span>Preview</span>
                                  </button>

                                  <a
                                    href={`/api/client/documents/${doc.document_id}/download`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                    title="Download certified copy"
                                  >
                                    <Download size={12} />
                                    <span>Download</span>
                                  </a>

                                  {doc.is_client_uploaded ? (
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      onClick={() => setDocToDelete(doc)}
                                      title="Delete client-uploaded document"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  ) : (
                                    <span
                                      title="Official pleadings and advocate filings cannot be deleted by litigants."
                                      style={{ cursor: 'help', color: '#94A3B8', padding: '0 4px' }}
                                    >
                                      <ShieldCheck size={14} />
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 4: HEARINGS & CAUSE LIST                              */}
          {/* ========================================================== */}
          {activeNav === 'hearings' && (
            <div className="workspace-tab-content">
              <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '0 0 4px 0' }}>
                      Court Cause List & Hearing Schedule
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                      Official court dates, benches, and case instructions approved for litigant attendance.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <button
                        type="button"
                        onClick={() => setHearingFilter('ALL')}
                        style={{
                          background: hearingFilter === 'ALL' ? '#FFFFFF' : 'transparent',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#172B4D',
                          cursor: 'pointer'
                        }}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setHearingFilter('UPCOMING')}
                        style={{
                          background: hearingFilter === 'UPCOMING' ? '#FFFFFF' : 'transparent',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#172B4D',
                          cursor: 'pointer'
                        }}
                      >
                        Upcoming
                      </button>
                      <button
                        type="button"
                        onClick={() => setHearingFilter('PAST')}
                        style={{
                          background: hearingFilter === 'PAST' ? '#FFFFFF' : 'transparent',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#172B4D',
                          cursor: 'pointer'
                        }}
                      >
                        Past
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={fetchHearings}
                      title="Refresh Schedule"
                    >
                      <RefreshCw size={13} className={hearingsLoading ? 'btn-spinner' : ''} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {hearingsLoading ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
                    <RefreshCw size={26} className="btn-spinner" style={{ margin: '0 auto 10px' }} />
                    <p style={{ margin: 0, fontSize: '13.5px' }}>Loading hearings cause list...</p>
                  </div>
                ) : hearingsError ? (
                  <div className="feedback-banner error" role="alert">
                    <AlertTriangle size={18} />
                    <span>{hearingsError}</span>
                  </div>
                ) : filteredHearings.length === 0 ? (
                  <div className="empty-state-box" style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <Calendar size={40} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ margin: '0 0 6px 0', color: '#172B4D', fontSize: '15px' }}>
                      No Hearings Scheduled
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                      There are no scheduled hearings matching your filter.
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="legal-data-table">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Case Reference</th>
                          <th>Court Room / Bench</th>
                          <th>Presiding Judge</th>
                          <th>Hearing Status</th>
                          <th>Instructions & Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHearings.map((h) => (
                          <tr key={h.hearing_id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={15} color="#B99A5B" />
                                <span style={{ fontWeight: 700, color: '#172B4D', fontSize: '13.5px' }}>
                                  {formatDateTime(h.hearing_date)}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#172B4D', fontSize: '13px' }}>
                                {h.case_number}
                              </span>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>{h.case_title}</div>
                            </td>
                            <td style={{ fontSize: '13px', color: '#172B4D' }}>{h.court_room}</td>
                            <td style={{ fontSize: '13px', color: '#172B4D' }}>{h.judge_name}</td>
                            <td>
                              <span className="badge-tag" style={{ background: '#FAF6EF', color: '#B99A5B', border: '1px solid #E8DCC4' }}>
                                {h.hearing_status}
                              </span>
                            </td>
                            <td style={{ fontSize: '12.5px', color: '#64748B', maxWidth: '280px' }}>
                              {h.notes || 'Arguments and consideration on scheduled cause list.'}
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
          {/* VIEW 5: CONTACT ADVOCATE & INQUIRY SUBMISSION              */}
          {/* ========================================================== */}
          {activeNav === 'contact' && (
            <div className="workspace-tab-content">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '28px', alignItems: 'flex-start' }}>
                {/* Left Column: Authorized Advocates Information */}
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#172B4D', margin: '0 0 16px 0' }}>
                    Supervising Legal Counsel
                  </h3>

                  {advocates.length === 0 ? (
                    <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                      <User size={36} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>No advocate assigned yet.</p>
                    </div>
                  ) : (
                    advocates.map((adv) => (
                      <div
                        key={adv.advocate_id}
                        className="dashboard-card"
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E5E9F0',
                          borderRadius: '12px',
                          padding: '24px',
                          marginBottom: '20px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#172B4D', color: '#B99A5B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800 }}>
                            {adv.full_name.charAt(0)}
                          </div>
                          <div>
                            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#172B4D', margin: 0 }}>
                              {adv.full_name}
                            </h4>
                            <span style={{ fontSize: '12px', color: '#B99A5B', fontWeight: 600 }}>
                              Advocate & Legal Counsel
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#334155', borderTop: '1px solid #E5E9F0', paddingTop: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Mail size={15} color="#B99A5B" />
                            <a href={`mailto:${adv.email}`} style={{ color: '#172B4D', fontWeight: 600 }}>
                              {adv.email}
                            </a>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Phone size={15} color="#B99A5B" />
                            <span>{adv.phone}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Building size={15} color="#B99A5B" />
                            <span>{adv.chambers}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Briefcase size={15} color="#B99A5B" />
                            <span>{adv.active_cases} Active proceeding(s)</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  <div style={{ background: '#FAF6EF', border: '1px solid #E8DCC4', borderRadius: '10px', padding: '16px', fontSize: '12.5px', color: '#5C4A28', lineHeight: 1.5 }}>
                    <Info size={16} color="#B99A5B" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    <strong>Privileged Channel:</strong> All communications submitted via this portal are registered directly to your case file and are strictly privileged under the Advocates Act.
                  </div>
                </div>

                {/* Right Column: Inquiry Submission Form & History */}
                <div>
                  <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#F4F6F9', color: '#172B4D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Send size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D', margin: 0 }}>
                          Submit Advisory Inquiry or Case Note
                        </h3>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          Direct inquiry logged to your advocate's practice ledger
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handleInquirySubmit}>
                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                          Select Relevant Case *
                        </label>
                        <select
                          className="select-filter"
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E5E9F0', fontSize: '13px', fontWeight: 600, color: '#172B4D' }}
                          value={inquiryCaseId}
                          onChange={(e) => setInquiryCaseId(e.target.value)}
                          required
                        >
                          <option value="">-- Choose Matter --</option>
                          {cases.map((c) => (
                            <option key={c.case_id} value={c.case_id}>
                              {c.case_number} — {c.title.substring(0, 32)}...
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                          Subject / Topic *
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E5E9F0', padding: '0 12px', fontSize: '13px' }}
                          placeholder="e.g. Question regarding upcoming cause list attendance"
                          value={inquirySubject}
                          onChange={(e) => setInquirySubject(e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ marginBottom: '18px' }}>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                          Inquiry Details *
                        </label>
                        <textarea
                          rows={4}
                          className="input-field"
                          style={{ width: '100%', borderRadius: '8px', border: '1px solid #E5E9F0', padding: '10px 12px', fontSize: '13px', resize: 'vertical' }}
                          placeholder="Provide details or questions for your counsel..."
                          value={inquiryMessage}
                          onChange={(e) => setInquiryMessage(e.target.value)}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-md"
                        disabled={submittingInquiry || !inquiryCaseId || !inquirySubject.trim()}
                      >
                        {submittingInquiry ? (
                          <>
                            <RefreshCw size={15} className="btn-spinner" />
                            <span>Submitting to Counsel...</span>
                          </>
                        ) : (
                          <>
                            <Send size={15} />
                            <span>Send Legal Inquiry</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Previous Inquiries */}
                  <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D', margin: '0 0 16px 0' }}>
                      Inquiry & Advisory History
                    </h3>

                    {inquiriesLoading ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        <RefreshCw size={20} className="btn-spinner" style={{ margin: '0 auto 8px' }} />
                        <p style={{ margin: 0, fontSize: '12.5px' }}>Loading inquiries...</p>
                      </div>
                    ) : inquiries.length === 0 ? (
                      <div className="empty-state-box" style={{ padding: '28px 16px', textAlign: 'center' }}>
                        <MessageSquare size={32} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>No previous inquiries submitted.</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="legal-data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Case</th>
                              <th>Subject & Inquiry</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inquiries.map((inq) => (
                              <tr key={inq.inquiry_id}>
                                <td style={{ fontSize: '12px', color: '#64748B' }}>
                                  {formatDate(inq.created_at)}
                                </td>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>
                                    {inq.case_number}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '13px' }}>{inq.subject}</div>
                                  <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {inq.message_text}
                                  </div>
                                </td>
                                <td>
                                  <span className="badge-tag" style={{ background: '#FAF6EF', color: '#B99A5B' }}>
                                    {inq.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 6: MY PROFILE                                         */}
          {/* ========================================================== */}
          {activeNav === 'profile' && (
            <div className="workspace-tab-content">
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div className="dashboard-card" style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', borderBottom: '1px solid #E5E9F0', paddingBottom: '24px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#172B4D', color: '#B99A5B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
                      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#172B4D', margin: '0 0 4px 0' }}>
                        {user?.full_name || 'Client Litigant'}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge-tag" style={{ background: '#FAF6EF', color: '#B99A5B', border: '1px solid #E8DCC4' }}>
                          ROLE: CLIENT
                        </span>
                        <span className="badge-status open">ACTIVE PORTAL</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                        Registered Email
                      </label>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#172B4D' }}>
                        {user?.email || '—'}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                        Litigant Telephone
                      </label>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#172B4D' }}>
                        {overviewData?.client_profile?.phone || '+91 98765 43210'}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                        Official Notice Address
                      </label>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#172B4D' }}>
                        {overviewData?.client_profile?.address || 'Confidential Address on File'}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                        Registered Since
                      </label>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#172B4D' }}>
                        {formatDate(overviewData?.client_profile?.member_since || new Date())}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '28px', borderTop: '1px solid #E5E9F0', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                      Client Verified Session • Enterprise Data Protection
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setShowLogoutConfirm(true)}
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* CASE DETAILS MODAL                                           */}
      {/* ------------------------------------------------------------ */}
      {showCaseModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-large" style={{ maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #E5E9F0', padding: '20px 24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#172B4D', fontSize: '14px', background: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                    {selectedCaseDetail?.case_number || 'CASE FILE'}
                  </span>
                  <span className="badge-type">{selectedCaseDetail?.case_type}</span>
                  <span className="badge-status open">{selectedCaseDetail?.case_status}</span>
                </div>
                <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '4px 0 0' }}>
                  {selectedCaseDetail?.title || 'Loading Matter...'}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setShowCaseModal(false);
                  setSelectedCaseDetail(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Subtabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E9F0', padding: '0 24px', background: '#FAFCFE', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCaseModalTab('overview')}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: caseModalTab === 'overview' ? '2px solid #172B4D' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: caseModalTab === 'overview' ? '#172B4D' : '#64748B',
                  cursor: 'pointer'
                }}
              >
                Overview & Counsel
              </button>
              <button
                type="button"
                onClick={() => setCaseModalTab('hearings')}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: caseModalTab === 'hearings' ? '2px solid #172B4D' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: caseModalTab === 'hearings' ? '#172B4D' : '#64748B',
                  cursor: 'pointer'
                }}
              >
                Hearings ({selectedCaseDetail?.hearings?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setCaseModalTab('documents')}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: caseModalTab === 'documents' ? '2px solid #172B4D' : '2px solid transparent',
                  background: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: caseModalTab === 'documents' ? '#172B4D' : '#64748B',
                  cursor: 'pointer'
                }}
              >
                Documents ({selectedCaseDetail?.documents?.length || 0})
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {caseDetailLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={26} className="btn-spinner" style={{ margin: '0 auto 10px' }} />
                  <p style={{ margin: 0, fontSize: '13.5px' }}>Loading case file details...</p>
                </div>
              ) : selectedCaseDetail ? (
                <div>
                  {caseModalTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Advocate Info Card */}
                      <div style={{ background: '#F8FAFC', border: '1px solid #E5E9F0', borderRadius: '10px', padding: '18px 20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#B99A5B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                          Supervising Legal Advocate
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                          <div>
                            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#172B4D', margin: '0 0 2px' }}>
                              {selectedCaseDetail.advocate?.full_name}
                            </h4>
                            <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                              {selectedCaseDetail.advocate?.email} • {selectedCaseDetail.advocate?.phone}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                              {selectedCaseDetail.advocate?.chambers}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setShowCaseModal(false);
                              setInquiryCaseId(selectedCaseDetail.case_id);
                              setActiveNav('contact');
                            }}
                          >
                            <MessageSquare size={13} />
                            <span>Inquire With Counsel</span>
                          </button>
                        </div>
                      </div>

                      {/* Case Description */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#172B4D', marginBottom: '6px' }}>
                          Official Case Description & Pleadings Scope
                        </label>
                        <div style={{ background: '#FFFFFF', border: '1px solid #E5E9F0', borderRadius: '8px', padding: '16px', fontSize: '13.5px', color: '#334155', lineHeight: 1.6 }}>
                          {selectedCaseDetail.description || 'Proceeding registered with counsel for regular litigation and representation.'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748B', borderTop: '1px solid #E5E9F0', paddingTop: '14px' }}>
                        <span>Filing Date: {formatDate(selectedCaseDetail.created_at)}</span>
                        <span>Privileged Client Access Verified</span>
                      </div>
                    </div>
                  )}

                  {caseModalTab === 'hearings' && (
                    <div>
                      {selectedCaseDetail.hearings?.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                          <Calendar size={32} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                          <p style={{ margin: 0, fontSize: '13px' }}>No court hearings registered for this matter yet.</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="legal-data-table">
                            <thead>
                              <tr>
                                <th>Date & Time</th>
                                <th>Court Room</th>
                                <th>Judge Name</th>
                                <th>Status</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedCaseDetail.hearings?.map((h) => (
                                <tr key={h.hearing_id}>
                                  <td style={{ fontWeight: 600, color: '#172B4D' }}>{formatDateTime(h.hearing_date)}</td>
                                  <td>{h.court_room}</td>
                                  <td>{h.judge_name}</td>
                                  <td><span className="badge-tag">{h.hearing_status}</span></td>
                                  <td style={{ fontSize: '12px', color: '#64748B' }}>{h.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {caseModalTab === 'documents' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '13px', color: '#64748B' }}>
                          Documents associated with this legal matter
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setShowCaseModal(false);
                            setUploadCaseId(selectedCaseDetail.case_id);
                            setActiveNav('documents');
                          }}
                        >
                          <Upload size={13} />
                          <span>Upload To This Case</span>
                        </button>
                      </div>

                      {selectedCaseDetail.documents?.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                          <FileText size={32} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                          <p style={{ margin: 0, fontSize: '13px' }}>No documents registered for this matter yet.</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="legal-data-table">
                            <thead>
                              <tr>
                                <th>File Name</th>
                                <th>Type</th>
                                <th>Uploaded Date</th>
                                <th>By</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedCaseDetail.documents?.map((d) => (
                                <tr key={d.document_id}>
                                  <td style={{ fontWeight: 600, color: '#172B4D' }}>{d.file_name}</td>
                                  <td><span className="badge-tag">{d.mime_type}</span></td>
                                  <td>{formatDate(d.uploaded_at)}</td>
                                  <td>{d.uploaded_by_name}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <a
                                      href={`/api/client/documents/${d.document_id}/download`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-secondary btn-sm"
                                    >
                                      <Download size={12} />
                                      <span>Download</span>
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #E5E9F0', padding: '16px 24px', background: '#FAFCFE', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowCaseModal(false);
                  setSelectedCaseDetail(null);
                }}
              >
                Close File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* DOCUMENT PREVIEW MODAL                                        */}
      {/* ------------------------------------------------------------ */}
      {showPreviewModal && previewDoc && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-large" style={{ maxWidth: '820px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #E5E9F0', padding: '20px 24px' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '0 0 2px' }}>
                  {previewDoc.file_name}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Case: {previewDoc.case_number} • Uploaded {formatDate(previewDoc.uploaded_at)}
                </span>
              </div>
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

            <div className="modal-body" style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {previewLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={24} className="btn-spinner" style={{ margin: '0 auto 10px' }} />
                  <p style={{ margin: 0, fontSize: '13.5px' }}>Loading document text...</p>
                </div>
              ) : (
                <div>
                  <div style={{ background: '#FAF8F3', border: '1px solid #E8DCC4', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: '#5C4A28', marginBottom: '16px' }}>
                    <ShieldCheck size={14} color="#B99A5B" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Privileged Client Document Preview. For certified filing signatures, download the original document.
                  </div>

                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '20px',
                      fontFamily: 'monospace',
                      fontSize: '12.5px',
                      lineHeight: '1.65',
                      color: '#1E293B',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '440px',
                      overflowY: 'auto'
                    }}
                  >
                    {previewDoc.preview_text || 'No readable text extracted for this document.'}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #E5E9F0', padding: '16px 24px', background: '#FAFCFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={`/api/client/documents/${previewDoc.document_id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
              >
                <Download size={13} />
                <span>Download Original Document</span>
              </a>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewDoc(null);
                }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* CLIENT-APPROVED AI SUMMARY MODAL                             */}
      {/* ------------------------------------------------------------ */}
      {showSummaryModal && summaryDoc && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-large" style={{ maxWidth: '820px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #E5E9F0', padding: '20px 24px' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#FAF6EF', color: '#B99A5B', border: '1px solid #E8DCC4', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
                  <Sparkles size={12} />
                  <span>AI LEGAL BRIEF • COUNSEL VERIFIED</span>
                </div>
                <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: 0 }}>
                  {summaryDoc.file_name}
                </h3>
              </div>
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

            <div className="modal-body" style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {summaryLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
                  <RefreshCw size={24} className="btn-spinner" style={{ margin: '0 auto 10px' }} />
                  <p style={{ margin: 0, fontSize: '13.5px' }}>Loading counsel-verified summary...</p>
                </div>
              ) : summaryData?.has_summary ? (
                <div>
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E5E9F0',
                      borderRadius: '10px',
                      padding: '24px',
                      fontSize: '14px',
                      lineHeight: '1.7',
                      color: '#172B4D',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {summaryData.summary_text}
                  </div>

                  <div style={{ marginTop: '20px', padding: '14px 18px', background: '#FAF8F3', border: '1px solid #E8DCC4', borderRadius: '8px', fontSize: '12.5px', color: '#5C4A28', lineHeight: 1.5 }}>
                    <AlertCircle size={16} color="#B99A5B" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    <strong>Informational Disclaimer:</strong> {summaryData.disclaimer || 'This document overview is prepared for informational assistance. Please consult your assigned advocate for formal legal advice.'}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '48px', textAlign: 'center', background: '#FAFCFE', borderRadius: '10px', border: '1px solid #E5E9F0' }}>
                  <Sparkles size={32} color="#B99A5B" style={{ margin: '0 auto 10px' }} />
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px' }}>
                    Summary Awaiting Counsel Clearance
                  </h4>
                  <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
                    The AI summary for this document is being processed or awaiting verification by your supervising advocate.
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #E5E9F0', padding: '16px 24px', background: '#FAFCFE', display: 'flex', justifyContent: 'flex-end' }}>
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
      )}

      {/* ------------------------------------------------------------ */}
      {/* DELETE CONFIRMATION MODAL                                    */}
      {/* ------------------------------------------------------------ */}
      {docToDelete && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-small">
            <div className="modal-header">
              <h3 className="modal-title">Confirm Document Removal</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDocToDelete(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                Are you sure you want to remove <strong>{docToDelete.file_name}</strong> from Case{' '}
                <strong>{docToDelete.case_number}</strong>?
              </p>
              <div style={{ background: '#FFF1F2', border: '1px solid #FFE4E6', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#9F1239' }}>
                This will delete the file from the case record and notify your supervising advocate.
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDocToDelete(null)}
                disabled={deletingDoc}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleExecuteDeleteDoc}
                disabled={deletingDoc}
              >
                {deletingDoc ? (
                  <>
                    <RefreshCw size={13} className="btn-spinner" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
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
              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to end your active litigation session? You will need to sign in again to view case filings.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={logout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
