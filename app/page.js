'use client';

import Link from 'next/link';
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  Layers,
  Scale,
  Sparkles,
  HelpCircle,
  Eye,
  Sliders,
  AlertCircle
} from 'lucide-react';

export default function PublicLandingPage() {
  return (
    <div className="space-y-20 py-6">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eaf2ed] border border-[#d0e2d5] text-[#2d523e] text-xs font-semibold">
          <Scale className="w-3.5 h-3.5" />
          <span>DPDP Act, 2023 & DPDP Rules, 2025 Conformance</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 tracking-tight leading-tight">
          Automated Website Privacy Assessments for Modern Businesses
        </h1>

        <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-2xl mx-auto">
          Evaluate your website's cookie banners, privacy notices, data collection forms, and grievance channels against India's privacy law &mdash; with actionable evidence and clear next steps.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
          <Link
            href="/portal/onboarding"
            id="hero-start-assessment-btn"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-sm hover:shadow transition-all"
          >
            <span>Start Website Assessment</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 shadow-2xs transition-all"
          >
            <span>How It Works</span>
          </Link>
        </div>

        {/* Safety & Trust micro-indicators */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2d523e]" />
            Safe, read-only inspection
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2d523e]" />
            No passwords or sensitive tokens needed
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2d523e]" />
            Audit-ready PDF & Excel reports
          </span>
        </div>
      </section>

      {/* 3-Step Simple Explanation */}
      <section id="how-it-works" className="space-y-8 scroll-mt-24">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-semibold text-[#2d523e] uppercase tracking-wider block">
            Simple 3-Step Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">
            How Your Website Is Assessed
          </h2>
          <p className="text-xs sm:text-sm text-stone-500">
            No technical knowledge required. We inspect publicly accessible website flows and provide step-by-step guidance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="p-6 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-3 relative">
            <div className="w-9 h-9 rounded-xl bg-[#eaf2ed] text-[#2d523e] flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h3 className="text-base font-bold text-stone-900">
              Provide Details
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Enter your website URL, organization profile, and active website features in a quick 5-minute wizard. Upload existing privacy policies if available.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-3 relative">
            <div className="w-9 h-9 rounded-xl bg-[#eaf2ed] text-[#2d523e] flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h3 className="text-base font-bold text-stone-900">
              Run Assessment
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Our automated browser inspector verifies your cookie banners, notice disclosures, contact forms, and security safeguards safely without slowing down your site.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-3 relative">
            <div className="w-9 h-9 rounded-xl bg-[#eaf2ed] text-[#2d523e] flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h3 className="text-base font-bold text-stone-900">
              Review Report
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Receive a clear, evidence-backed compliance report with plain-English findings, pass/fail status, and practical instructions for your development team.
            </p>
          </div>
        </div>
      </section>

      {/* What We Check Section */}
      <section id="checks" className="space-y-8 scroll-mt-24">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-semibold text-[#2d523e] uppercase tracking-wider block">
            Scope of Assessment
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">
            What the Assessment Checks
          </h2>
          <p className="text-xs sm:text-sm text-stone-500">
            Every inspection aligns with specific statutory requirements of the Digital Personal Data Protection Act, 2023.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e]">
                Section 5
              </span>
              <h3 className="text-sm font-bold text-stone-900">Privacy Notice Clarity</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Checks that itemized notices declare what personal data is collected, the specific purpose, user rights, and Grievance Officer contacts.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e]">
                Section 6(1)
              </span>
              <h3 className="text-sm font-bold text-stone-900">Affirmative Consent</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Ensures cookie banners require positive opt-in and do not use pre-ticked checkboxes or deceptive dark patterns.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e]">
                Section 6(4)
              </span>
              <h3 className="text-sm font-bold text-stone-900">Ease of Consent Withdrawal</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Verifies that users can withdraw consent with the same ease with which consent was granted (e.g. cookie preference toggle).
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e]">
                Section 8(9)
              </span>
              <h3 className="text-sm font-bold text-stone-900">Grievance Redressal Pathway</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Confirms the published presence of a designated Grievance Officer name, official email, and statutory response timeline.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e]">
                Section 8(5)
              </span>
              <h3 className="text-sm font-bold text-stone-900">Credential & Form Safeguards</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Validates HTTPS transmission encryption, credential masking in password fields, and prevention of sensitive URL leaks.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e]">
                Rule 3 (2025)
              </span>
              <h3 className="text-sm font-bold text-stone-900">Multi-Lingual Notice Access</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Reviews whether privacy information is available in English and scheduled Indian languages for wider accessibility.
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Legal Disclaimer Banner */}
      <section className="p-6 rounded-2xl bg-[#f7f8f7] border border-stone-200/90 space-y-3">
        <div className="flex items-center gap-2.5 text-stone-900 font-semibold text-sm">
          <AlertCircle className="w-4 h-4 text-[#2d523e]" />
          <span>Statutory Authority & Limitations</span>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed">
          The DPDP Vault platform references authoritative publications of the <strong>Digital Personal Data Protection Act, 2023</strong> and the <strong>Digital Personal Data Protection Rules, 2025</strong> published by the Ministry of Electronics and Information Technology (MeitY). 
          Our evaluations are automated technical assessment aids. They do not constitute official government certification, a formal audit by the Data Protection Board of India (DPBI), or a substitute for professional legal counsel.
        </p>
      </section>

      {/* Call to Action Card */}
      <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#2d523e] to-[#1e382a] text-white text-center space-y-5 shadow-sm">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight max-w-xl mx-auto">
          Start Your Organization&apos;s Website Privacy Assessment
        </h2>
        <p className="text-xs sm:text-sm text-stone-200 max-w-lg mx-auto leading-relaxed">
          Get a traceable assessment report in minutes. Understand where your website stands and what changes are needed to meet DPDP standards.
        </p>
        <div className="pt-2">
          <Link
            href="/portal/onboarding"
            id="bottom-cta-start-btn"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-white hover:bg-stone-100 text-[#2d523e] shadow-sm transition-all"
          >
            <span>Start Website Assessment</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
