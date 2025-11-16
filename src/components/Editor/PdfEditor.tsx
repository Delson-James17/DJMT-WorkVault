// src/components/Editor/PdfEditor.tsx
import React, { useState } from "react";
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
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [imageAnnotations, setImageAnnotations] = useState<ImageAnnotation[]>([]);
  const [newText, setNewText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const addTextAnnotation = () => {
    if (!newText.trim()) return;

    const annotation: TextAnnotation = {
      id: Date.now().toString(),
      text: newText,
      x: 100,
      y: 100,
      page: currentPage,
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
        page: currentPage,
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

  const handleDownload = () => {
    window.open(url, '_blank');
  };

  return (
    <div>
      <Alert variant="info" className="mb-3">
        <strong>PDF Viewer</strong>
        <p className="mb-0">View and annotate your PDF document. Click "Download" to view the full PDF in a new tab.</p>
      </Alert>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <Form.Control
          type="number"
          placeholder="Page"
          value={currentPage}
          onChange={(e) => setCurrentPage(Number(e.target.value) || 1)}
          style={{ width: 100 }}
          size="sm"
          min={1}
        />
        
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
        
        <Button size="sm" variant="primary" onClick={handleDownload}>
          Download PDF
        </Button>
      </div>

      {/* PDF Preview using iframe or object */}
      <div 
        style={{ 
          border: "1px solid #ddd", 
          backgroundColor: "#f5f5f5",
          padding: 10,
          marginBottom: 20
        }}
      >
        <iframe
          src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
          style={{
            width: '100%',
            height: '600px',
            border: 'none',
            borderRadius: '4px'
          }}
          title="PDF Viewer"
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
                  onClick={() => removeTextAnnotation(a.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {imageAnnotations.length > 0 && (
        <div className="mt-3">
          <strong>Image Annotations:</strong>
          <ul>
            {imageAnnotations.map(a => (
              <li key={a.id}>
                Page {a.page}: Image annotation
                <Button 
                  size="sm" 
                  variant="link" 
                  className="text-danger"
                  onClick={() => setImageAnnotations(prev => prev.filter(img => img.id !== a.id))}
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