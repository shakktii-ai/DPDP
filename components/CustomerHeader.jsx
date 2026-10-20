'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Shield,
  ArrowRight,
  User,
  LogOut,
  LogIn,
  SlidersHorizontal,
  ChevronDown,
  Menu,
  X,
  ExternalLink
} from 'lucide-react';

export default function CustomerHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const navLinks = [
    { label: 'Overview', href: '/' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'What We Check', href: '/#checks' },
    { label: 'Customer Workspace', href: '/portal' },
  ];

  const isStaffOrAdmin = user && ['admin', 'platform_administrator', 'assessment_reviewer'].includes(user.role);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-[#eaf2ed] border border-[#d0e2d5] text-[#2d523e] flex items-center justify-center shadow-xs group-hover:bg-[#e0ede4] transition-colors">
              <Shield className="w-5 h-5 text-[#2d523e]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 text-base tracking-tight">DPDP Vault</span>
                <span className="text-[10px] font-semibold text-[#2d523e] bg-[#eaf2ed] px-2 py-0.5 rounded-full border border-[#d0e2d5]">
                  Privacy Audit
                </span>
              </div>
              <p className="text-[11px] text-stone-600 font-medium hidden sm:block">
                Digital Personal Data Protection Act, 2023
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'text-[#2d523e] font-semibold bg-[#eaf2ed]'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Controls & Primary Action */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-xs text-stone-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-500" />
                  <span className="font-semibold">{user.name}</span>
                </div>

                {isStaffOrAdmin && (
                  <Link
                    href="/admin"
                    className="text-xs text-stone-500 hover:text-stone-800 px-2 py-1 rounded hover:bg-stone-100 flex items-center gap-1"
                    title="Switch to Internal Admin Operations Console"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#2d523e]" />
                    <span>Admin View</span>
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Primary Customer CTA */}
            <Link
              href="/portal/onboarding"
              id="header-start-assessment-btn"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs hover:shadow transition-all"
            >
              <span>Start Assessment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-stone-200 space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-stone-200 flex flex-col gap-2">
              <Link
                href="/portal/onboarding"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center px-4 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] text-white"
              >
                Start Website Assessment
              </Link>
              {isStaffOrAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center px-4 py-1.5 rounded-lg text-xs text-stone-600 bg-stone-100"
                >
                  Admin Operations Console
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
