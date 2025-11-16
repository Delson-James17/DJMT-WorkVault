// src/components/Editor/PdfEditor.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button, Form, Alert } from "react-bootstrap";

type TextAnnotation = {
  id: string;
  text: string;
  x: number;
  y: number;
  page: number;
};

type ImageAnnotation = {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
};

interface PdfEditorProps {
  url: string;
  onSave: (annotations: { texts: TextAnnotation[]; images: ImageAnnotation[] }) => void;
}

export const PdfEditor: React.FC<PdfEditorProps> = ({ url, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [imageAnnotations, setImageAnnotations] = useState<ImageAnnotation[]>([]);
  const [newText, setNewText] = useState("");
  const [scale, setScale] = useState(1.5);
  const [pdfLib, setPdfLib] = useState<typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<Record<string, unknown> | null>(null);

  // Load PDF.js dynamically
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setPdfLib(pdfjsLib);
      } catch (err) {
        console.error('Failed to load PDF.js:', err);
        setError('Failed to load PDF library');
        setLoading(false);
      }
    };
    loadPdfJs();
  }, []);

  // Render annotations overlay
  const renderAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw text annotations for current page
    textAnnotations
      .filter(a => a.page === currentPage)
      .forEach(annotation => {
        ctx.font = "16px Arial";
        ctx.fillStyle = "red";
        ctx.fillText(annotation.text, annotation.x, annotation.y);
      });

    // Draw image annotations for current page
    imageAnnotations
      .filter(a => a.page === currentPage)
      .forEach(annotation => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, annotation.x, annotation.y, annotation.width, annotation.height);
        };
        img.src = annotation.url;
      });
  }, [currentPage, textAnnotations, imageAnnotations]);

  // Render specific page
  const renderPage = useCallback(async (pdf: Record<string, unknown>, pageNum: number) => {
    try {
      const page = await (pdf.getPage as (n: number) => Promise<Record<string, unknown>>)(pageNum);
      const viewport = (page.getViewport as (opts: { scale: number }) => Record<string, unknown>)({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.height = viewport.height as number;
      canvas.width = viewport.width as number;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await (page.render as (ctx: Record<string, unknown>) => { promise: Promise<void> })(renderContext).promise;
      
      // Render annotations on top
      renderAnnotations();
    } catch (err) {
      console.error("Page rendering error:", err);
      setError(`Failed to render page: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [scale, renderAnnotations]);

  // Load and render PDF
  useEffect(() => {
    if (!pdfLib) return;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load the PDF document
        const loadingTask = pdfLib.getDocument({
          url: url,
          withCredentials: false,
          isEvalSupported: false,
        });

        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf as unknown as Record<string, unknown>;
        setNumPages((pdf as unknown as Record<string, unknown>).numPages as number);
        setLoading(false);

        // Render first page
        await renderPage(pdf as unknown as Record<string, unknown>, 1);
      } catch (err) {
        console.error("PDF loading error:", err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    };

    if (url) {
      loadPdf();
    }
  }, [url, pdfLib, renderPage]);

  // Re-render when page changes
  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(pdfDocRef.current, currentPage);
    }
  }, [currentPage, scale, renderPage]);

  // Add text annotation at center of canvas
  const addTextAnnotation = () => {
    if (!newText.trim()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const annotation: TextAnnotation = {
      id: Date.now().toString(),
      text: newText,
      x: canvas.width / 2,
      y: canvas.height / 2,
      page: currentPage,
    };

    setTextAnnotations(prev => [...prev, annotation]);
    setNewText("");
    
    // Re-render to show new annotation
    setTimeout(() => renderAnnotations(), 100);
  };

  // Add image annotation
  const addImageAnnotation = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const annotation: ImageAnnotation = {
        id: Date.now().toString(),
        url: event.target?.result as string,
        x: canvas.width / 2 - 50,
        y: canvas.height / 2 - 50,
        width: 100,
        height: 100,
        page: currentPage,
      };

      setImageAnnotations(prev => [...prev, annotation]);
      
      // Re-render to show new annotation
      setTimeout(() => renderAnnotations(), 100);
    };
    reader.readAsDataURL(file);
  };

  // Page navigation
  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= numPages) {
      setCurrentPage(pageNum);
    }
  };

  // Save annotations
  const handleSave = () => {
    onSave({ texts: textAnnotations, images: imageAnnotations });
    alert("Annotations saved!");
  };

  if (loading) {
    return <Alert variant="info">Loading PDF...</Alert>;
  }

  if (error) {
    return (
      <Alert variant="danger">
        <strong>Error:</strong> {error}
        <br />
        <small>Make sure the PDF URL is accessible and CORS is enabled on your storage bucket.</small>
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <Button size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
          Previous
        </Button>
        <span>
          Page {currentPage} of {numPages}
        </span>
        <Button size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>
          Next
        </Button>
        
        <div className="ms-3">
          <label className="me-2">Zoom:</label>
          <Button size="sm" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}>-</Button>
          <span className="mx-2">{Math.round(scale * 100)}%</span>
          <Button size="sm" onClick={() => setScale(s => Math.min(3, s + 0.25))}>+</Button>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <Form.Control
          type="text"
          placeholder="Enter text to add"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          style={{ width: 200 }}
          size="sm"
        />
        <Button size="sm" onClick={addTextAnnotation} disabled={!newText.trim()}>
          Add Text
        </Button>
        
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={addImageAnnotation}
            style={{ display: "none" }}
            id="image-upload"
          />
          <label htmlFor="image-upload">
            <Button size="sm" as="span">Add Image</Button>
          </label>
        </div>

        <Button size="sm" variant="success" onClick={handleSave}>
          Save Annotations
        </Button>
      </div>

      <div 
        ref={containerRef}
        style={{ 
          border: "1px solid #ddd", 
          overflow: "auto",
          maxHeight: "70vh",
          backgroundColor: "#f5f5f5",
          padding: 10
        }}
      >
        <canvas 
          ref={canvasRef}
          style={{ 
            display: "block",
            margin: "0 auto",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
        />
      </div>

      {textAnnotations.length > 0 && (
        <div className="mt-3">
          <strong>Text Annotations:</strong>
          <ul>
            {textAnnotations.map(a => (
              <li key={a.id}>
                Page {a.page}: &quot;{a.text}&quot;
                <Button 
                  size="sm" 
                  variant="link" 
                  className="text-danger"
                  onClick={() => {
                    setTextAnnotations(prev => prev.filter(t => t.id !== a.id));
                    setTimeout(() => renderAnnotations(), 100);
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};