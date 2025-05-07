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
          return katex.renderToString(math, { displayMode: true, throwOnError: false, trust: true, output: "htmlAndMathml" });
        } catch (e) {
          console.error("KaTeX display error:", e);
          return `<span class="text-destructive">Error rendering: ${math}</span>`;
        }
      });
      // Replace inline math $...$
      content = content.replace(/(^|[^\\])\$(.+?)\$/g, (match, prefix, math) => {
        if (match.startsWith('$$') || match.endsWith('$$') ) return match; 
        try {
          return prefix + katex.renderToString(math, { displayMode: false, throwOnError: false, trust: true, output: "htmlAndMathml" });
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
      // Log content of printable area before capturing
      // console.log('Printable area innerHTML before h2c:', printableAreaRef.current.innerHTML);

      const canvas = await html2canvas(printableAreaRef.current, {
        scale: 2, 
        useCORS: true, 
        logging: process.env.NODE_ENV === 'development',
        backgroundColor: '#ffffff', // Ensure canvas background is white
        onclone: (clonedDoc) => {
          const head = clonedDoc.head;
          if (head) {
            // Copy <link rel="stylesheet"> elements from original document
            document.querySelectorAll('link[rel="stylesheet"]').forEach(linkEl => {
              const newLink = clonedDoc.createElement('link');
              newLink.rel = 'stylesheet';
              // Ensure href is absolute or correctly resolved
              newLink.href = (linkEl as HTMLLinkElement).href; 
              head.appendChild(newLink);
            });
            // Copy <style> elements from original document
            document.querySelectorAll('style').forEach(styleEl => {
              const newStyle = clonedDoc.createElement('style');
              newStyle.textContent = styleEl.textContent;
              head.appendChild(newStyle);
            });
          } else {
            console.warn('Cloned document has no head element.');
          }
          
          // console.log('Cloned document head:', clonedDoc.head.innerHTML);

          // Wait for images in the cloned document
          const images = clonedDoc.getElementsByTagName('img');
          const imagePromises = [];
          for (let i = 0; i < images.length; i++) {
            if (!images[i].complete && images[i].src) {
              imagePromises.push(new Promise((resolve, reject) => {
                images[i].onload = resolve;
                images[i].onerror = () => {
                  console.warn(`Cloned image failed to load: ${images[i].src}`);
                  resolve(null); // Resolve even on error to not block PDF generation
                };
                // Add a timeout for image loading as a fallback
                setTimeout(() => {
                    if (!images[i].complete) {
                        console.warn(`Cloned image timed out: ${images[i].src}`);
                        resolve(null);
                    }
                }, 5000); // 5 second timeout per image
              }));
            }
          }
          return Promise.all(imagePromises).then(() => {
            console.log('Stylesheet links, style tags, and images processed for cloned document.');
            // Optional: small delay for fonts to render, this is a fallback
            // return new Promise(resolve => setTimeout(resolve, 300));
          }).catch(err => {
            console.error('Error processing images in cloned document:', err);
          });
        },
      });
      
      // console.log('Canvas generated, width:', canvas.width, 'height:', canvas.height);
      const imgData = canvas.toDataURL('image/png');
      // console.log('Image data URL length:', imgData.length);

      if (imgData.length < 1000) { // Arbitrary small length to detect blank/failed canvas
          throw new Error('Generated image data seems too small, canvas might be blank.');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt', 
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 40; 
      const contentAreaWidth = pdfWidth - 2 * margin;
      const contentAreaHeight = pdfHeight - 2 * margin;

      const imgProps = pdf.getImageProperties(imgData);
      const imgOriginalWidth = imgProps.width; 
      const imgOriginalHeight = imgProps.height; 
      const imgAspectRatio = imgOriginalWidth / imgOriginalHeight;

      let pdfImgWidth = contentAreaWidth;
      let pdfImgHeight = pdfImgWidth / imgAspectRatio;

      if (pdfImgHeight > contentAreaHeight) { 
        pdfImgHeight = contentAreaHeight;
        pdfImgWidth = pdfImgHeight * imgAspectRatio;
      }
      
      const x = margin + (contentAreaWidth - pdfImgWidth) / 2;
      const y = margin + (contentAreaHeight - pdfImgHeight) / 2;
      
      // console.log('Adding image to PDF at x:', x, 'y:', y, 'width:', pdfImgWidth, 'height:', pdfImgHeight);
      pdf.addImage(imgData, 'PNG', x, y, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
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
        description: `An error occurred: ${errorMessage}. Check console for details. PDF fonts or styles might be affected.`,
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

      {/* Hidden div for PDF generation. Styled to match A4 paper aspect ratio at 96 DPI (794x1123px approx). */}
      {/* Width is 794px. Height will be auto based on content. */}
      {/* Ensure this div is in the DOM when handleDownloadPDF is called. */}
      <div 
        id="printableArea" 
        ref={printableAreaRef} 
        className="absolute -left-[9999px] top-auto w-[794px] p-10 bg-white text-black" 
        aria-hidden="true" 
      >
         <div
            className="markdown-preview" 
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
      </div>
    </div>
  );
}
