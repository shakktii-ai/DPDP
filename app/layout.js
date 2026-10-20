import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'DPDP Vault — Automated Website Privacy Assessment',
  description:
    'Automated technical privacy and consent assessment platform under India\'s Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025. Safe browser inspection and audit-ready reports.',
  keywords: [
    'DPDP Act',
    'India Data Protection',
    'Consent Notice Audit',
    'Website Privacy Compliance',
    'Data Fiduciary'
  ]
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fafaf9'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
