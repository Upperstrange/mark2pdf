
import type { Metadata } from 'next';
import Script from 'next/script';
import { GeistSans } from 'geist/font/sans';
// import { GeistMono } from 'geist/font/mono'; // This was causing an error, assuming it's not strictly needed or fixed elsewhere. If needed, ensure 'geist' package is correctly providing it.
import './globals.css';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';

const geistSans = GeistSans;
// const geistMono = GeistMono; // Assuming this was problematic

export const metadata: Metadata = {
  title: 'Mark2PDF - Markdown to PDF Converter',
  description: 'Easily convert Markdown text with tables and LaTeX math into downloadable PDF files.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Adsense Script */}
        {adsenseClientId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive" // Load after the page is interactive
          />
        )}
      </head>
      <body 
        className={`${geistSans.variable} font-sans antialiased flex flex-col min-h-screen`}
        // className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased flex flex-col min-h-screen`} // Removed geistMono if problematic
        suppressHydrationWarning={true} 
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
