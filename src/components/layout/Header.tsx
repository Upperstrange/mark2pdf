
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export function Header() {
  return (
    <header className="py-4 px-6 bg-card border-b shadow-sm">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
          <FileText className="h-8 w-8" />
          <span>Mark2PDF</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
