'use client';

import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Eye } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from "@/hooks/use-toast";

const DEFAULT_MARKDOWN = `# Mark2PDF Demo

This is a demonstration of **Mark2PDF**, a tool to convert Markdown to PDF.

## Features

- Supports standard Markdown syntax.
- Renders tables beautifully.
- Handles LaTeX math expressions.

### Example Table

| Feature         | Status      | Notes                       |
|-----------------|-------------|-----------------------------|
| Markdown        | Supported   | Basic & Extended Syntax     |
| Tables          | Supported   | Using GFM table syntax      |
| LaTeX Math      | Supported   | Inline & Display modes      |
| PDF Download    | Supported   | Click the button below!     |

### LaTeX Math Examples

Inline math: $E = mc^2$

Display math:
$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

You can type your own Markdown in the editor above!
`;


export default function Home() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [htmlContent, setHtmlContent] = useState('');
  const { toast } = useToast();
  const printableAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderLaTeX = (content: string) => {
      // Replace display math $$...$$
      content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        try {
          return katex.renderToString(math, { displayMode: true, throwOnError: false });
        } catch (e) {
          console.error("KaTeX display error:", e);
          return `<span class="text-destructive">Error rendering: ${math}</span>`;
        }
      });
      // Replace inline math $...$
      content = content.replace(/\$([\s\S]*?)\$/g, (match, math) => {
        // Avoid rendering $ in code blocks or already rendered math
        if (match.startsWith('$$') || match.endsWith('$$')) return match;
        try {
          return katex.renderToString(math, { displayMode: false, throwOnError: false });
        } catch (e) {
          console.error("KaTeX inline error:", e);
          return `<span class="text-destructive">Error rendering: ${math}</span>`;
        }
      });
      return content;
    };

    const rawHtml = marked.parse(markdown, { breaks: true, gfm: true }) as string;
    const htmlWithLatex = renderLaTeX(rawHtml);
    setHtmlContent(htmlWithLatex);
  }, [markdown]);

  const handleDownloadPDF = async () => {
    if (!printableAreaRef.current) {
      toast({
        title: "Error",
        description: "Could not find printable area.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Generating PDF",
      description: "Please wait, your PDF is being generated...",
    });

    try {
      // Ensure KaTeX fonts are loaded before rendering
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for fonts

      const canvas = await html2canvas(printableAreaRef.current, {
        scale: 2, // Increase scale for better quality
        useCORS: true, // If you have external images
        logging: false,
        onclone: (document) => {
          // Apply styles to ensure KaTeX fonts are embedded or rendered correctly
          const katexStylesheets = Array.from(document.head.querySelectorAll('link[href*="katex"]'));
          katexStylesheets.forEach(link => {
            // For simplicity, we'll assume styles are loaded. 
            // In a complex scenario, you might fetch and inline them.
          });
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt', // Use points for better consistency with HTML/CSS
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = imgProps.width;
      const imgHeight = imgProps.height;

      // Calculate scaling factor to fit image within A4, maintaining aspect ratio
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      // Center the image on the page
      const x = (pdfWidth - scaledWidth) / 2;
      const y = (pdfHeight - scaledHeight) / 2;
      
      // Add a small margin if content is smaller than page.
      const margin = 20; // points
      const finalX = Math.max(x, margin);
      const finalY = Math.max(y, margin);
      const finalWidth = Math.min(scaledWidth, pdfWidth - 2 * margin);
      const finalHeight = Math.min(scaledHeight, pdfHeight - 2 * margin);


      pdf.addImage(imgData, 'PNG', finalX, finalY, finalWidth, finalHeight);
      pdf.save('mark2pdf_document.pdf');
      
      toast({
        title: "PDF Downloaded",
        description: "Your PDF has been successfully generated and downloaded.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "PDF Generation Failed",
        description: "An error occurred while generating the PDF. Please check console for details.",
        variant: "destructive",
      });
    }
  };
  

  return (
    <div className="flex flex-col space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-semibold">Markdown Editor</CardTitle>
          <CardDescription>
            Enter your Markdown content below. It supports standard Markdown, tables, and LaTeX math.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Type your Markdown here..."
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="min-h-[300px] text-base rounded-md shadow-sm focus:ring-primary focus:border-primary"
            aria-label="Markdown Input Area"
          />
        </CardContent>
      </Card>

      <div className="flex justify-center my-4">
        <Button 
          onClick={handleDownloadPDF} 
          className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105"
          aria-label="Download PDF"
        >
          <Download className="mr-2 h-5 w-5" />
          Download as PDF
        </Button>
      </div>
      
      <Separator className="my-8"/>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-semibold flex items-center">
            <Eye className="mr-3 h-7 w-7 text-primary" />
            Live Preview
          </CardTitle>
          <CardDescription>
            This is how your Markdown content will look.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] w-full rounded-md border p-4 shadow-inner bg-background">
            <div
              className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none markdown-preview"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              aria-live="polite"
            />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Hidden div for PDF generation */}
      <div id="printableArea" ref={printableAreaRef} className="absolute -left-[9999px] top-auto w-[794px] p-8 bg-white text-black">
         <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
      </div>
    </div>
  );
}
