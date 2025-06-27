import '@/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Seller Portal' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
