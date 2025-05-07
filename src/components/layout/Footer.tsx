export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="py-6 px-6 text-center text-sm text-muted-foreground border-t mt-auto">
      <div className="container mx-auto">
        <p>&copy; {currentYear} Mark2PDF. All rights reserved.</p>
        <p className="mt-1">
          Effortlessly convert your Markdown to PDF.
        </p>
      </div>
    </footer>
  );
}
