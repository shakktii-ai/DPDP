'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Lock, Mail, User, ArrowRight, AlertTriangle } from 'lucide-react';
import { ROLES } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: ROLES.ORGANIZATION_OWNER,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      // Redirect directly to the customer onboarding wizard
      router.push('/portal/onboarding');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 rounded-3xl bg-white border border-stone-200/90 shadow-xs space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#eaf2ed] border border-[#d0e2d5] flex items-center justify-center text-[#2d523e]">
            <ShieldCheck className="w-6 h-6 text-[#2d523e]" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            Create Your Account
          </h2>
          <p className="text-xs text-stone-500">
            Set up access to evaluate and monitor your website privacy readiness
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Your Full Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="Dr. Priya Sharma"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-900 text-xs focus:ring-1 focus:ring-[#2d523e] focus:border-[#2d523e] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Business Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="priya@company.com"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-900 text-xs focus:ring-1 focus:ring-[#2d523e] focus:border-[#2d523e] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Password (Minimum 6 characters) *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-900 text-xs focus:ring-1 focus:ring-[#2d523e] focus:border-[#2d523e] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Account Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-900 text-xs focus:ring-1 focus:ring-[#2d523e] focus:border-[#2d523e] focus:outline-none"
            >
              <option value={ROLES.ORGANIZATION_OWNER}>Organization Owner (Manage entity & website targets)</option>
              <option value={ROLES.USER}>Standard User (View workspace & reports)</option>
              <option value={ROLES.ASSESSMENT_REVIEWER}>Assessment Reviewer (Audit & compliance reviewer)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-2xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <span>Register & Continue to Wizard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-stone-100 text-center text-xs text-stone-500">
          <span>Already have an account? </span>
          <Link href="/login" className="text-[#2d523e] hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
