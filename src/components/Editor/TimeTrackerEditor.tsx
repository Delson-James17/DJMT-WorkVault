// src/components/Editor/TimeTrackerEditor.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../api/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Form, Row, Col, Card, Spinner, Modal } from "react-bootstrap";
import Dropzone from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/* --------------------------
   Types & helpers
-------------------------- */
type Cell = { id: string; text: string };

type TemplateData = {
  headerImage?: { url?: string; storagePath?: string };
  rows: Cell[][];
  attachment?: { url: string; type: "pdf" | "word" | "excel"; storagePath: string };
  meta?: { project?: string; period?: string; employeeName?: string };
  annotations?: PdfAnnotation[]; // Store annotations in template
};

const makeEmptyCell = (): Cell => ({ id: uuidv4(), text: "" });

const defaultTemplate: TemplateData = {
  rows: [[makeEmptyCell(), makeEmptyCell(), makeEmptyCell()]],
  meta: {},
  annotations: [],
};

/* --------------------------
   PDF Annotation types
-------------------------- */
type PdfAnnotation = {
  id: string;
  pageIndex: number;
  xPct: number;
  yPct: number;
  text: string;
  fontSize: number;
};

/* --------------------------
   Main Component
-------------------------- */
export const TimeTrackerEditor: React.FC<{ templateId?: string }> = ({ templateId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState<TemplateData>(defaultTemplate);
  const [name, setName] = useState("My Time Tracker");

  // PDF editor state
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [pdfNumPages] = useState<number>(1);
  const [showAnnotModal, setShowAnnotModal] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<PdfAnnotation | null>(null);

  /* --------------------------
     Load template (if editing)
  -------------------------- */
  const loadTemplate = useCallback(
    async (id: string) => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from("templates").select("*").eq("id", id).single();
        if (error) throw error;
        const loadedTemplate: TemplateData = data.template_data ?? defaultTemplate;
        setTemplate(loadedTemplate);
        setName(data.name ?? "My Time Tracker");
        setAnnotations(loadedTemplate.annotations ?? []);
      } catch (err) {
        console.error(err);
        alert("Failed to load template");
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (templateId) loadTemplate(templateId);
  }, [templateId, loadTemplate]);

  /* --------------------------
     Upload helper
  -------------------------- */
  const uploadFile = async (file: File, folder: string) => {
    if (!user) throw new Error("Sign in first");

    const storagePath = `${user.id}/${uuidv4()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(folder)
      .upload(storagePath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(folder).getPublicUrl(storagePath);
    const publicUrl = data?.publicUrl;

    const { error: insertError } = await supabase.from("file_bank").insert({
      user_id: user.id,
      filename: file.name,
      storage_path: storagePath,
      content_type: file.type,
      size: file.size,
    });

    if (insertError) {
      console.error("Database insert error:", insertError);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    return { storagePath, url: publicUrl ?? "" };
  };

  /* --------------------------
     Drag & drop handlers
  -------------------------- */
  const onDropFile = async (acceptedFiles: File[]) => {
    if (!user) return alert("Sign in first");
    const file = acceptedFiles[0];
    if (!file) return;
    setLoading(true);
    try {
      let type: "pdf" | "word" | "excel";
      if (file.type === "application/pdf") type = "pdf";
      else if (file.type.includes("word") || file.name.endsWith(".docx")) type = "word";
      else if (file.type.includes("spreadsheet") || file.name.endsWith(".xlsx")) type = "excel";
      else throw new Error("Unsupported file type");

      const { storagePath, url } = await uploadFile(file, "file-bank");
      setTemplate(prev => ({ ...prev, attachment: { storagePath, url, type } }));
      setAnnotations([]);
    } catch (err) {
      console.error(err);
      alert(`Failed to upload file: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const onDropHeaderImage = async (files: File[]) => {
    if (!user) return alert("Sign in first");
    const file = files[0];
    if (!file) return;
    setLoading(true);
    try {
      const { storagePath, url } = await uploadFile(file, "file-bank");
      setTemplate(prev => ({ ...prev, headerImage: { storagePath, url } }));
    } catch (err) {
      console.error(err);
      alert(`Failed to upload header image: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------
     Save template
  -------------------------- */
  const saveTemplate = async () => {
    if (!user) return alert("Sign in first");
    setLoading(true);
    try {
      const templateWithAnnotations = { ...template, annotations };
      const payload = { name, template_data: templateWithAnnotations, user_id: user.id };
      if (!templateId) {
        const { error } = await supabase.from("templates").insert(payload);
        if (error) throw error;
        alert("Template saved");
      } else {
        const { error } = await supabase.from("templates").update(payload).eq("id", templateId);
        if (error) throw error;
        alert("Template updated");
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to save template: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------
     PDF Editor logic
  -------------------------- */
  const onPdfClick = (e: React.MouseEvent) => {
    if (!pdfContainerRef.current || !template.attachment) return;

    const container = pdfContainerRef.current;
    const rect = container.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const offsetX = e.clientX - rect.left;

    const pageCount = Math.max(1, pdfNumPages);
    const pageHeightPx = rect.height / pageCount;
    let pageIndex = Math.floor(offsetY / pageHeightPx);
    if (pageIndex < 0) pageIndex = 0;
    if (pageIndex >= pageCount) pageIndex = pageCount - 1;

    const pageTop = pageIndex * pageHeightPx;
    const xPct = offsetX / rect.width;
    const yPct = (offsetY - pageTop) / pageHeightPx;

    const newAnnot: PdfAnnotation = {
      id: uuidv4(),
      pageIndex,
      xPct: Math.max(0, Math.min(1, xPct)),
      yPct: Math.max(0, Math.min(1, yPct)),
      text: "Edit me",
      fontSize: 12,
    };

    setAnnotations(prev => [...prev, newAnnot]);
    setEditingAnnotation(newAnnot);
    setShowAnnotModal(true);
  };

  const saveAnnotationEdit = (updated: PdfAnnotation) => {
    setAnnotations(prev => prev.map(a => (a.id === updated.id ? updated : a)));
    setEditingAnnotation(null);
    setShowAnnotModal(false);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    setEditingAnnotation(null);
    setShowAnnotModal(false);
  };

  const exportPdfWithAnnotations = async (alsoUpload = false) => {
    if (!template.attachment?.url) return alert("No PDF loaded");
    setLoading(true);
    try {
      const res = await fetch(template.attachment.url);
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`);
      const arrayBuffer = await res.arrayBuffer();
      const srcPdf = await PDFDocument.load(arrayBuffer);
      const pdfCopy = await PDFDocument.create();

      const copiedPages = await pdfCopy.copyPages(srcPdf, srcPdf.getPageIndices());
      copiedPages.forEach(p => pdfCopy.addPage(p));

      const helv = await pdfCopy.embedFont(StandardFonts.Helvetica);

      annotations.forEach(a => {
        const page = pdfCopy.getPage(a.pageIndex);
        const { width, height } = page.getSize();
        const x = a.xPct * width;
        const y = (1 - a.yPct) * height;
        const padding = 2;
        const textWidth = helv.widthOfTextAtSize(a.text, a.fontSize);
        const textHeight = a.fontSize;

        try {
          page.drawRectangle({
            x: x - padding,
            y: y - padding,
            width: textWidth + 2 * padding,
            height: textHeight + 2 * padding,
            color: rgb(1, 1, 1),
          });
        } catch (err) {
          console.error("Error drawing rectangle:", err);
        }

        page.drawText(a.text, { x, y, size: a.fontSize, font: helv, color: rgb(0, 0, 0) });
      });

      const mergedBytes = await pdfCopy.save();
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name.replace(/\s+/g, "_") || "time-tracker"}-edited.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      if (alsoUpload && user) {
        const newFile = new File([blob], `${uuidv4()}-${name.replace(/\s+/g, "_")}-edited.pdf`, { type: "application/pdf" });
        const folder = "file-bank";
        const storagePath = `${user.id}/${newFile.name}`;
        const { error: uploadError } = await supabase.storage.from(folder).upload(storagePath, newFile, { upsert: true, contentType: "application/pdf" });
        if (uploadError) {
          console.error("Upload error:", uploadError);
          alert("Edited PDF downloaded but failed to upload edited file.");
        } else {
          await supabase.from("file_bank").insert({ user_id: user.id, filename: newFile.name, storage_path: storagePath, content_type: "application/pdf", size: newFile.size });
          alert("Edited PDF uploaded to File Bank");
        }
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to export PDF: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------
     Styles
  -------------------------- */
  const matteBg: React.CSSProperties = { background: "#0f0f10", minHeight: 200, padding: 12, color: "#eaeaea" };
  const panelStyle: React.CSSProperties = { background: "#171717", borderRadius: 8, padding: 12, border: "1px solid #222" };
  const yellowBtn: React.CSSProperties = { background: "#FFD700", border: "none", color: "#000", fontWeight: 600, boxShadow: "0 2px 6px rgba(0,0,0,0.4)" };

  /* --------------------------
     Render
  -------------------------- */
  return (
    <div style={{ padding: 16 }}>
      <Card style={{ background: "#111", border: "none", color: "#fff" }}>
        <Card.Body style={{ ...matteBg }}>
          <Row className="align-items-center mb-3">
            <Col md={6}>
              <Form.Control
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Template Name"
                style={{ background: "#0b0b0b", color: "#fff", border: "1px solid #222" }}
              />
            </Col>
            <Col md={6} className="text-end">
              <Button style={yellowBtn} onClick={saveTemplate} disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : "Save Template"}
              </Button>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={8}>
              <Dropzone onDrop={onDropFile} multiple={false} accept={{ "application/pdf": [], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [] }}>
                {({ getRootProps, getInputProps }) => (
                  <div {...getRootProps()} style={{ ...panelStyle, border: "2px dashed #2b2b2b", cursor: "pointer", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <input {...getInputProps()} />
                    <div style={{ textAlign: "center" }}>
                      {template.attachment ? (
                        <div>
                          <div style={{ fontWeight: 700 }}>{template.attachment.type.toUpperCase()}</div>
                          <div style={{ fontSize: 12, color: "#bbbbbb" }}>{template.attachment.url}</div>
                        </div>
                      ) : (
                        <div style={{ color: "#ddd" }}>Drop PDF / Word / Excel here (optional)</div>
                      )}
                    </div>
                  </div>
                )}
              </Dropzone>
            </Col>

            <Col md={4}>
              <Dropzone onDrop={onDropHeaderImage} accept={{ "image/*": [] }} multiple={false}>
                {({ getRootProps, getInputProps }) => (
                  <div {...getRootProps()} style={{ ...panelStyle, border: "2px dashed #2b2b2b", cursor: "pointer", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <input {...getInputProps()} />
                    <div style={{ textAlign: "center", color: "#ddd" }}>
                      {template.headerImage?.url ? <img src={template.headerImage.url} alt="header" style={{ maxHeight: 48 }} /> : <div>Drop header image (optional)</div>}
                    </div>
                  </div>
                )}
              </Dropzone>
            </Col>
          </Row>

          {template.attachment?.type === "pdf" && (
            <>
              <div style={{ marginBottom: 8, color: "#FFD700", fontWeight: 600 }}>
                Click anywhere on the PDF to add text annotations
              </div>
              <div 
                ref={pdfContainerRef} 
                style={{ 
                  border: "1px solid #333", 
                  minHeight: 300, 
                  cursor: "crosshair", 
                  position: "relative",
                  background: "#1a1a1a"
                }} 
                onClick={onPdfClick}
              >
                <iframe 
                  src={template.attachment.url} 
                  width="100%" 
                  height={400} 
                  title="PDF Preview" 
                  style={{ pointerEvents: "none", border: "none" }}
                />
                
                {/* Render annotations as overlays */}
                {annotations.map(annot => {
                  const pageCount = Math.max(1, pdfNumPages || 1);
                  const containerHeight = 400; // Match iframe height
                  const pageHeight = containerHeight / pageCount;
                  const top = annot.pageIndex * pageHeight + annot.yPct * pageHeight;
                  const left = annot.xPct * 100;
                  
                  return (
                    <div
                      key={annot.id}
                      style={{
                        position: "absolute",
                        top: `${top}px`,
                        left: `${left}%`,
                        transform: "translate(-50%, -50%)",
                        background: "rgba(255, 215, 0, 0.9)",
                        padding: "4px 8px",
                        borderRadius: 4,
                        fontSize: `${annot.fontSize}px`,
                        fontWeight: 600,
                        cursor: "pointer",
                        pointerEvents: "auto",
                        whiteSpace: "nowrap",
                        color: "#000",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        border: "1px solid #000",
                        zIndex: 10
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAnnotation(annot);
                        setShowAnnotModal(true);
                      }}
                    >
                      {annot.text}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {template.attachment?.type === "pdf" && (
            <div className="mt-3">
              <Button onClick={() => exportPdfWithAnnotations(false)} style={{ ...yellowBtn, marginRight: 8 }}>Download PDF</Button>
              <Button onClick={() => exportPdfWithAnnotations(true)} style={yellowBtn}>Download & Upload Edited PDF</Button>
              {annotations.length > 0 && (
                <span style={{ marginLeft: 12, color: "#FFD700" }}>
                  {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Annotation modal */}
          <Modal show={showAnnotModal} onHide={() => setShowAnnotModal(false)}>
            <Modal.Header closeButton style={{ background: "#1a1a1a", borderColor: "#333", color: "#fff" }}>
              <Modal.Title>Edit Annotation</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ background: "#0f0f10", color: "#fff" }}>
              {editingAnnotation && (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>Text</Form.Label>
                    <Form.Control
                      value={editingAnnotation.text}
                      onChange={e => setEditingAnnotation({ ...editingAnnotation, text: e.target.value })}
                      style={{ background: "#0b0b0b", color: "#fff", border: "1px solid #333" }}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Font Size ({editingAnnotation.fontSize}px)</Form.Label>
                    <Form.Control
                      type="range"
                      value={editingAnnotation.fontSize}
                      onChange={e => setEditingAnnotation({ ...editingAnnotation, fontSize: parseInt(e.target.value) || 12 })}
                      min={8}
                      max={48}
                      style={{ background: "#0b0b0b" }}
                    />
                  </Form.Group>
                </>
              )}
            </Modal.Body>
            <Modal.Footer style={{ background: "#1a1a1a", borderColor: "#333" }}>
              <Button variant="secondary" onClick={() => setShowAnnotModal(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => editingAnnotation && removeAnnotation(editingAnnotation.id)}>Delete</Button>
              <Button style={yellowBtn} onClick={() => editingAnnotation && saveAnnotationEdit(editingAnnotation)}>Save</Button>
            </Modal.Footer>
          </Modal>
        </Card.Body>
      </Card>
    </div>
  );
};