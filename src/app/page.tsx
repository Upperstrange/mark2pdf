
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
          return katex.renderToString(math, { displayMode: true, throwOnError: false, trust: true });
        } catch (e) {
          console.error("KaTeX display error:", e);
          return `<span class="text-destructive">Error rendering: ${math}</span>`;
        }
      });
      // Replace inline math $...$
      content = content.replace(/(^|[^\\])\$(.+?)\$/g, (match, prefix, math) => {
        // Avoid rendering $ in code blocks or already rendered math by looking at prefix
        // This regex is basic, for more complex scenarios a proper AST parser or marked extension would be better.
        if (match.startsWith('$$') || match.endsWith('$$') ) return match; // Avoid processing parts of display math
        try {
          return prefix + katex.renderToString(math, { displayMode: false, throwOnError: false, trust: true });
        } catch (e) {
          console.error("KaTeX inline error:", e);
          return prefix + `<span class="text-destructive">Error rendering: ${math}</span>`;
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
      let katexCSS = '';
      try {
        // Attempt to find and fetch KaTeX CSS. This relies on Next.js outputting katex.min.css
        // or a bundle containing its name in a predictable way.
        const katexLink = document.querySelector<HTMLLinkElement>('link[href*="katex.min.css"], link[href*="katex"]');
        if (katexLink?.href) {
          const response = await fetch(katexLink.href);
          if (response.ok) {
            katexCSS = await response.text();
          } else {
            console.warn(`Failed to fetch KaTeX CSS from ${katexLink.href}. Status: ${response.status}. PDF fonts might be affected.`);
          }
        } else {
           console.warn('KaTeX CSS link tag not found. PDF fonts might be affected.');
        }
      } catch (e) {
        console.warn('Error fetching or processing KaTeX CSS:', e);
      }

      const canvas = await html2canvas(printableAreaRef.current, {
        scale: 2, // Improves resolution
        useCORS: true, 
        logging: false, 
        onclone: (clonedDoc) => {
          if (katexCSS) {
            const style = clonedDoc.createElement('style');
            style.textContent = katexCSS;
            clonedDoc.head.appendChild(style);
          }
          // Additional measure: Ensure all images in the cloned document are loaded.
          // html2canvas typically waits for images, but this can be a fallback.
          const images = clonedDoc.getElementsByTagName('img');
          const imagePromises = [];
          for (let i = 0; i < images.length; i++) {
            if (!images[i].complete) {
              imagePromises.push(new Promise(resolve => {
                images[i].onload = images[i].onerror = resolve;
              }));
            }
          }
          return Promise.all(imagePromises);
        },
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt', // Use points for better consistency
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 40; // 40 points margin (approx 0.55 inches)
      const contentAreaWidth = pdfWidth - 2 * margin;
      const contentAreaHeight = pdfHeight - 2 * margin;

      const imgProps = pdf.getImageProperties(imgData);
      const imgOriginalWidth = imgProps.width; // Pixel width of the canvas image
      const imgOriginalHeight = imgProps.height; // Pixel height of the canvas image
      const imgAspectRatio = imgOriginalWidth / imgOriginalHeight;

      // Calculate dimensions of the image in PDF points, fitting contentArea
      let pdfImgWidth = contentAreaWidth; // Assume it's limited by width
      let pdfImgHeight = pdfImgWidth / imgAspectRatio;

      if (pdfImgHeight > contentAreaHeight) { // If that makes height too large, it's limited by height
        pdfImgHeight = contentAreaHeight;
        pdfImgWidth = pdfImgHeight * imgAspectRatio;
      }
      
      // Center the image within the content area (which starts at margin, margin)
      const x = margin + (contentAreaWidth - pdfImgWidth) / 2;
      const y = margin + (contentAreaHeight - pdfImgHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, pdfImgWidth, pdfImgHeight);
      pdf.save('mark2pdf_document.pdf');
      
      toast({
        title: "PDF Downloaded",
        description: "Your PDF has been successfully generated and downloaded.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: "PDF Generation Failed",
        description: `An error occurred: ${errorMessage}. Check console for details.`,
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
            className="min-h-[300px] text-base rounded-md shadow-sm focus:ring-primary focus:border-primary font-mono"
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

      {/* Hidden div for PDF generation. Styled to match A4 paper aspect ratio at 96 DPI (794x1123px). */}
      {/* Width is 794px. Height will be auto based on content. Padding is applied internally. */}
      <div 
        id="printableArea" 
        ref={printableAreaRef} 
        className="absolute -left-[9999px] top-auto w-[794px] p-10 bg-white text-black" /* Increased padding for visual margin in canvas */
      >
         <div
            className="markdown-preview" /* This class applies prose styles */
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
      </div>
    </div>
  );
}

