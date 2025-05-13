
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
import GoogleAd from '@/components/ads/GoogleAd'; // Import the GoogleAd component

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

  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const adsenseSlotId1 = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID_1;

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
      const canvas = await html2canvas(printableAreaRef.current, {
        scale: 2, 
        useCORS: true, 
        logging: process.env.NODE_ENV === 'development',
        backgroundColor: '#ffffff', // Ensure canvas background is white
        onclone: (clonedDoc) => {
          const clonedPrintableArea = clonedDoc.getElementById('printableArea');
          if (clonedPrintableArea) {
            // Apply styles to make text black for PDF rendering for all elements within printableArea
            const allElements = clonedPrintableArea.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
              (allElements[i] as HTMLElement).style.color = '#000000';
            }
          }

          const head = clonedDoc.head;
          if (head) {
            document.querySelectorAll('link[rel="stylesheet"]').forEach(linkEl => {
              const newLink = clonedDoc.createElement('link');
              newLink.rel = 'stylesheet';
              newLink.href = (linkEl as HTMLLinkElement).href; 
              head.appendChild(newLink);
            });
            document.querySelectorAll('style').forEach(styleEl => {
              const newStyle = clonedDoc.createElement('style');
              newStyle.textContent = styleEl.textContent;
              head.appendChild(newStyle);
            });
             // Add specific KaTeX CSS to cloned document for html2canvas
            const katexCSS = clonedDoc.createElement('link');
            katexCSS.rel = 'stylesheet';
            katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'; // Use CDN
            katexCSS.integrity = 'sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV';
            katexCSS.crossOrigin = 'anonymous';
            head.appendChild(katexCSS);
          }
          
          const images = clonedDoc.getElementsByTagName('img');
          const imagePromises: Promise<void>[] = [];
          for (let i = 0; i < images.length; i++) {
            if (!images[i].complete && images[i].src) {
              imagePromises.push(new Promise((resolve) => {
                images[i].onload = () => resolve();
                images[i].onerror = () => {
                  console.warn(`Cloned image failed to load: ${images[i].src}`);
                  resolve(); 
                };
                setTimeout(() => {
                    if (!images[i].complete) {
                        console.warn(`Cloned image timed out: ${images[i].src}`);
                        resolve();
                    }
                }, 5000);
              }));
            }
          }
          return Promise.all(imagePromises).then(() => {
             // Small delay for styles and fonts to apply in the cloned document
            return new Promise(resolve => setTimeout(resolve, 500));
          });
        },
      });
      
      const imgData = canvas.toDataURL('image/png');

      if (imgData.length < 1000) { 
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
      // Calculate total pages if content is longer than one page
      const totalPdfImgHeight = pdfImgHeight; // Height of the entire content as a single image
      let currentY = margin; // Initial Y position for the first image chunk

      if (totalPdfImgHeight <= contentAreaHeight) {
        // Content fits on one page
        pdf.addImage(imgData, 'PNG', x, currentY + (contentAreaHeight - pdfImgHeight) / 2, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
      } else {
        // Content spans multiple pages
        let remainingImgHeight = imgOriginalHeight;
        let currentImgY = 0; // Y position within the original canvas image

        while (remainingImgHeight > 0) {
          // Calculate the height of the chunk to draw on the current PDF page
          // The height on canvas corresponding to contentAreaHeight on PDF
          const sourceChunkHeight = (contentAreaHeight / pdfImgWidth) * imgOriginalWidth / imgAspectRatio;
          const actualChunkHeightOnCanvas = Math.min(remainingImgHeight, sourceChunkHeight);

          // Create a temporary canvas for the chunk
          const chunkCanvas = document.createElement('canvas');
          chunkCanvas.width = imgOriginalWidth;
          chunkCanvas.height = actualChunkHeightOnCanvas;
          const chunkCtx = chunkCanvas.getContext('2d');
          if (chunkCtx) {
            chunkCtx.drawImage(canvas, 0, currentImgY, imgOriginalWidth, actualChunkHeightOnCanvas, 0, 0, imgOriginalWidth, actualChunkHeightOnCanvas);
          }
          const chunkImgData = chunkCanvas.toDataURL('image/png');
          
          // Calculate dimensions for this chunk on the PDF page
          const chunkPdfImgHeight = (actualChunkHeightOnCanvas / imgOriginalWidth) * pdfImgWidth;
          const chunkX = margin + (contentAreaWidth - pdfImgWidth) / 2;

          pdf.addImage(chunkImgData, 'PNG', chunkX, currentY, pdfImgWidth, chunkPdfImgHeight, undefined, 'FAST');
          
          remainingImgHeight -= actualChunkHeightOnCanvas;
          currentImgY += actualChunkHeightOnCanvas;

          if (remainingImgHeight > 0) {
            pdf.addPage();
            currentY = margin; // Reset Y for new page
          }
        }
      }
      
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

      {/* Ad Unit Section */}
      {adsenseClientId && adsenseSlotId1 && (
        <div className="my-6 flex justify-center" aria-label="Advertisement Area">
          <GoogleAd
            client={adsenseClientId}
            slot={adsenseSlotId1}
            format="auto"
            responsive="true"
            className="w-full max-w-3xl bg-muted/50 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-md p-2"
            style={{ minHeight: '90px', height: 'auto' }}
          />
        </div>
      )}


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

      <div 
        id="printableArea" 
        ref={printableAreaRef} 
        className="absolute -left-[9999px] top-auto w-[794px] p-10 bg-white text-black" 
        style={{color: '#000000 !important'}} // Ensure base text is black for PDF
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
