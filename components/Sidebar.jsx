'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  FileCheck2,
  PlusCircle,
  PlaySquare,
  ShieldAlert,
  Wrench,
  FileText,
  Settings,
  Shield,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
  Globe
} from 'lucide-react';

const NAV_ITEMS = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    badge: null
  },
  {
    name: 'Customer Portal',
    href: '/portal',
    icon: Globe,
    badge: 'Client'
  },
  {
    name: 'Onboarding Wizard',
    href: '/onboarding',
    icon: PlusCircle,
    badge: 'Wizard'
  },
  {
    name: 'Organization Profile',
    href: '/organizations',
    icon: Building2,
    badge: null
  },
  {
    name: 'Approved Targets',
    href: '/targets',
    icon: Shield,
    badge: null
  },
  {
    name: 'Privacy Documents',
    href: '/documents',
    icon: FileText,
    badge: null
  },
  {
    name: 'Website Assessments',
    href: '/assessments',
    icon: FileCheck2,
    badge: null
  },
  {
    name: 'New Assessment',
    href: '/assessments/new',
    icon: PlusCircle,
    badge: 'Action'
  },
  {
    name: 'Live Testing',
    href: '/testing',
    icon: PlaySquare,
    badge: null
  },
  {
    name: 'Findings & Evidence',
    href: '/findings',
    icon: ShieldAlert,
    badge: null
  },
  {
    name: 'Remediation Tracker',
    href: '/remediation',
    icon: Wrench,
    badge: null
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: FileText,
    badge: null
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    badge: null
  }
];

export default function Sidebar({ dbStatus = true }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 rounded-lg bg-white text-slate-700 border border-slate-200 shadow-md focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#eaf2ed] border border-[#d0e2d5] flex items-center justify-center text-[#2d523e] shadow-sm">
            <Shield className="w-5 h-5 text-[#2d523e]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-base tracking-tight">DPDP Vault</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Compliance Operations</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Platform Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname === item.href || (item.href !== '/admin' && item.href !== '/portal' && pathname.startsWith(item.href + '/'));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive
                        ? 'text-[#2d523e]'
                        : 'text-slate-500 group-hover:text-slate-800'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                {item.badge ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {item.badge}
                  </span>
                ) : isActive ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#2d523e]" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Legal & Compliance Notice footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Compliance Framework</span>
              <span className="text-[10px] font-semibold text-[#2d523e]">DPDP Act 2023</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Automated consent notice, tracker verification & fiduciary audit tool.
            </p>
            <div className="pt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Database Engine</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[#2d523e]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                MongoDB
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
