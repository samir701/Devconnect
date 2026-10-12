import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ZettaDev • Developer Communication & Collaboration Workspace',
  description:
    'Simple, professional communication for software development teams with project context, code snippets, bugs, tasks, Backblaze B2 files, and AI assistance. Serverless on Vercel.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full bg-[#090d16] text-[#f1f5f9] flex flex-col overflow-hidden">
        {children}
      </body>
    </html>
  );
}
