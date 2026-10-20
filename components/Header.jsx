'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Database,
  Sparkles,
  RefreshCw,
  AlertCircle,
  User,
  LogOut,
  LogIn,
  Sliders
} from 'lucide-react';
import { ROLE_LABELS } from '@/lib/auth';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealthAndUser = async () => {
    try {
      const [healthRes, userRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/auth/me')
      ]);
      const healthData = await healthRes.json();
      const userData = await userRes.json();
      setHealth(healthData);
      if (userData.success) {
        setUser(userData.user);
      }
    } catch (e) {
      setHealth({
        status: 'degraded',
        services: {
          database: { connected: false },
          aiEngine: { configured: false, proposedModel: 'gemini-3.8-flash' }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthAndUser();
    const interval = setInterval(fetchHealthAndUser, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Format title from pathname
  const getPageMeta = () => {
    switch (pathname) {
      case '/':
        return { title: 'Compliance Dashboard', section: 'Overview' };
      case '/onboarding':
        return { title: 'Onboarding Wizard', section: 'Fiduciary Setup' };
      case '/organizations':
        return { title: 'Organization Profile', section: 'Entity Management' };
      case '/targets':
        return { title: 'Authorized Targets', section: 'Domain Registry' };
      case '/documents':
        return { title: 'Privacy Documents', section: 'Policies & Notices' };
      case '/assessments':
        return { title: 'Website Assessments', section: 'Audit Operations' };
      case '/assessments/new':
        return { title: 'New Assessment', section: 'Launch Assessment' };
      case '/testing':
        return { title: 'Live Testing Console', section: 'Browser Automation' };
      case '/findings':
        return { title: 'Findings & Evidence', section: 'Non-Conformities' };
      case '/remediation':
        return { title: 'Remediation Tracker', section: 'Corrective Actions' };
      case '/reports':
        return { title: 'Audit Reports', section: 'Executive & Compliance' };
      case '/settings':
        return { title: 'System Settings', section: 'Configuration' };
      case '/login':
        return { title: 'Authentication', section: 'Sign In' };
      case '/register':
        return { title: 'User Registration', section: 'Account Creation' };
      default:
        return { title: 'DPDP Assessment', section: 'Platform' };
    }
  };

  const { title, section } = getPageMeta();
  const isDbConnected = health?.services?.database?.connected;
  const aiStatus = health?.services?.aiEngine;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
      {/* Page Title & Breadcrumb */}
      <div className="pl-12 lg:pl-0">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
          <span>DPDP Platform</span>
          <span>/</span>
          <span className="text-slate-600 font-medium">{section}</span>
        </div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
      </div>

      {/* Header Actions & Connectivity Status */}
      <div className="flex items-center gap-3">
        {/* Database Status Pill */}
        <div
          title={isDbConnected ? 'MongoDB connected and ready' : 'MongoDB connection degraded'}
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isDbConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{isDbConnected ? 'DB Active' : 'DB Standby'}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isDbConnected ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'
            }`}
          />
        </div>

        {/* AI Model Pill */}
        <div
          title={
            aiStatus?.configured
              ? `AI Model Active: ${aiStatus.activeModel || aiStatus.proposedModel}`
              : 'AI Engine (GEMINI_API_KEY pending verification)'
          }
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {aiStatus?.activeModel
              ? aiStatus.activeModel
              : aiStatus?.proposedModel || 'gemini-3.8-flash'}
          </span>
          {aiStatus?.configured ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          ) : (
            <span className="text-[10px] text-amber-600 font-normal">(untested)</span>
          )}
        </div>

        {/* User Session or Login links */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-bold text-slate-900 truncate max-w-[140px]">
                {user.name}
              </span>
              <span className="text-[10px] font-semibold text-[#2d523e] uppercase tracking-wider block">
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-rose-600 transition-all border border-slate-200"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-[#eaf2ed] hover:bg-[#dfece3] text-[#2d523e] border border-[#d0e2d5] font-medium transition-all"
            >
              Register
            </Link>
          </div>
        )}

        {/* Onboarding Wizard Action Shortcut */}
        {pathname !== '/onboarding' && (
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 shadow-xs transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Onboard Entity</span>
          </Link>
        )}

        {/* Launch New Assessment CTA */}
        {pathname !== '/assessments/new' && (
          <Link
            href="/assessments/new"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Assessment</span>
            <span className="sm:hidden">New</span>
          </Link>
        )}
      </div>
    </header>
  );
}
