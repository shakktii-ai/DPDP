'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import CustomerHeader from '@/components/CustomerHeader';
import CustomerFooter from '@/components/CustomerFooter';

export default function AppShell({ children }) {
  const pathname = usePathname();

  // Determine whether this is a customer-facing route
  const isCustomerRoute =
    pathname === '/' ||
    pathname.startsWith('/portal') ||
    pathname === '/login' ||
    pathname === '/register';

  if (isCustomerRoute) {
    return (
      <div className="min-h-screen bg-[#fafaf9] text-stone-800 flex flex-col font-sans selection:bg-[#eaf2ed] selection:text-[#2d523e]">
        <CustomerHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <CustomerFooter />
      </div>
    );
  }

  // Internal Admin Operations Layout (Light Theme Refactor)
  return (
    <div className="bg-[#f8fafc] text-slate-900 min-h-screen antialiased flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        <Header />
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
        <footer className="border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500 bg-white">
          DPDP Vault &mdash; Administrator Operations &bull; Digital Personal Data Protection Act 2023 Conformance Engine
        </footer>
      </div>
    </div>
  );
}
