// src/components/Editor/PdfEditor.tsx
import React, { useState } from "react";
import { Button, Form, Alert } from "react-bootstrap";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker from CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [imageAnnotations, setImageAnnotations] = useState<ImageAnnotation[]>([]);
  const [newText, setNewText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error: Error): void {
    console.error('Error loading PDF:', error);
    setError(`Failed to load PDF: ${error.message}`);
    setLoading(false);
  }

  const addTextAnnotation = () => {
    if (!newText.trim()) return;

    const annotation: TextAnnotation = {
      id: Date.now().toString(),
      text: newText,
      x: 100,
      y: 100,
      page: pageNumber,
    };

    setTextAnnotations(prev => [...prev, annotation]);
    setNewText("");
  };

  const addImageAnnotation = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const annotation: ImageAnnotation = {
        id: Date.now().toString(),
        url: event.target?.result as string,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        page: pageNumber,
      };

      setImageAnnotations(prev => [...prev, annotation]);
    };
    reader.readAsDataURL(file);
  };

  const removeTextAnnotation = (id: string) => {
    setTextAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const handleSave = () => {
    onSave({ texts: textAnnotations, images: imageAnnotations });
    alert("Annotations saved!");
  };

  if (error) {
    return (
      <Alert variant="danger">
        <strong>Error:</strong> {error}
        <br />
        <small>Make sure the PDF URL is accessible.</small>
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <Button 
          size="sm" 
          onClick={() => setPageNumber(p => Math.max(1, p - 1))} 
          disabled={pageNumber <= 1}
        >
          Previous
        </Button>
        <span>
          Page {pageNumber} of {numPages || '?'}
        </span>
        <Button 
          size="sm" 
          onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} 
          disabled={pageNumber >= numPages}
        >
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
        style={{ 
          border: "1px solid #ddd", 
          overflow: "auto",
          maxHeight: "70vh",
          backgroundColor: "#f5f5f5",
          padding: 10,
          position: "relative"
        }}
      >
        {loading && (
          <div className="text-center p-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}
        
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="text-center p-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading PDF...</span>
              </div>
            </div>
          }
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
        
        {/* Render text annotations as overlays */}
        {textAnnotations
          .filter(a => a.page === pageNumber)
          .map(annotation => (
            <div
              key={annotation.id}
              style={{
                position: 'absolute',
                left: annotation.x,
                top: annotation.y,
                color: 'red',
                fontSize: '16px',
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 1000
              }}
            >
              {annotation.text}
            </div>
          ))}
          
        {/* Render image annotations as overlays */}
        {imageAnnotations
          .filter(a => a.page === pageNumber)
          .map(annotation => (
            <img
              key={annotation.id}
              src={annotation.url}
              alt="annotation"
              style={{
                position: 'absolute',
                left: annotation.x,
                top: annotation.y,
                width: annotation.width,
                height: annotation.height,
                pointerEvents: 'none',
                zIndex: 1000
              }}
            />
          ))}
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
                  onClick={() => removeTextAnnotation(a.id)}
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