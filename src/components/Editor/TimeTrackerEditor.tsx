// src/components/Editor/TimeTrackerEditor.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../api/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Form, Row, Col, Card, Spinner, Modal, Container } from "react-bootstrap";
import Dropzone from "react-dropzone";
import { v4 as uuidv4 } from "uuid";

/* --------------------------
   Types & helpers
-------------------------- */
type Cell = { id: string; text: string };

type TemplateData = {
  headerImage?: { url?: string; storagePath?: string };
  rows: Cell[][];
  attachment?: { url: string; type: "pdf" | "word" | "excel"; storagePath: string };
  meta?: { project?: string; period?: string; employeeName?: string };
  annotations?: PdfAnnotation[];
};

const makeEmptyCell = (): Cell => ({ id: uuidv4(), text: "" });

const defaultTemplate: TemplateData = {
  rows: [[makeEmptyCell(), makeEmptyCell(), makeEmptyCell()]],
  meta: {},
  annotations: [],
};

/* --------------------------
   PDF Annotation types - using absolute pixel coordinates
-------------------------- */
type PdfAnnotation = {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
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

  /* --------------------------
     Styles
  -------------------------- */
  const yellowBtn: React.CSSProperties = { 
    background: "#FFD700", 
    border: "none", 
    color: "#000", 
    fontWeight: 600, 
    boxShadow: "0 2px 6px rgba(0,0,0,0.4)" 
  };

  /* --------------------------
     Render
  -------------------------- */
  return (
    <>
      {/* Main Content */}
      <div style={{ 
        background: "#0f0f10",
        minHeight: "100vh",
        padding: "12px"
      }}>
        <Container fluid>
          <Card style={{ background: "transparent", border: "none", color: "#fff" }}>
            <Card.Body style={{ padding: "12px" }}>
              {/* Template Name & Save Button */}
              <Row className="align-items-center mb-3 g-2">
                <Col xs={12} md={6}>
                  <Form.Control
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Template Name"
                    style={{ background: "#0b0b0b", color: "#fff", border: "1px solid #222" }}
                  />
                </Col>
                <Col xs={12} md={6} className="text-md-end">
                  <Button style={{ ...yellowBtn, width: "100%", maxWidth: "200px" }} onClick={saveTemplate} disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" /> : "Save Template"}
                  </Button>
                </Col>
              </Row>

              {/* File Upload & Header Image */}
              <Row className="mb-3 g-2">
                <Col xs={12} lg={8}>
                  <Dropzone onDrop={onDropFile} multiple={false} accept={{ "application/pdf": [], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [] }}>
                    {({ getRootProps, getInputProps }) => (
                      <div {...getRootProps()} style={{ 
                        background: "#171717", 
                        borderRadius: 8, 
                        padding: 12, 
                        border: "2px dashed #2b2b2b", 
                        cursor: "pointer", 
                        minHeight: 60, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center" 
                      }}>
                        <input {...getInputProps()} />
                        <div style={{ textAlign: "center" }}>
                          {template.attachment ? (
                            <div>
                              <div style={{ fontWeight: 700 }}>{template.attachment.type.toUpperCase()}</div>
                              <div style={{ fontSize: 12, color: "#bbbbbb", wordBreak: "break-all" }}>
                                {template.attachment.url.length > 50 
                                  ? `...${template.attachment.url.slice(-50)}` 
                                  : template.attachment.url}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: "#ddd" }}>📎 Drop PDF / Word / Excel here</div>
                          )}
                        </div>
                      </div>
                    )}
                  </Dropzone>
                </Col>

                <Col xs={12} lg={4}>
                  <Dropzone onDrop={onDropHeaderImage} accept={{ "image/*": [] }} multiple={false}>
                    {({ getRootProps, getInputProps }) => (
                      <div {...getRootProps()} style={{ 
                        background: "#171717", 
                        borderRadius: 8, 
                        padding: 12, 
                        border: "2px dashed #2b2b2b", 
                        cursor: "pointer", 
                        minHeight: 60, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center" 
                      }}>
                        <input {...getInputProps()} />
                        <div style={{ textAlign: "center", color: "#ddd" }}>
                          {template.headerImage?.url ? (
                            <img src={template.headerImage.url} alt="header" style={{ maxHeight: 48, maxWidth: "100%" }} />
                          ) : (
                            <div>🖼️ Drop header image</div>
                          )}
                        </div>
                      </div>
                    )}
                  </Dropzone>
                </Col>
              </Row>

              {/* PDF Viewer */}
              {template.attachment?.type === "pdf" && (
                <>
                  <div style={{ marginBottom: 8, color: "#4CAF50", fontWeight: 600, fontSize: 14 }}>
                    📄 Use the PDF toolbar to draw, highlight, or add text annotations
                  </div>
                  <div 
                    ref={pdfContainerRef} 
                    style={{ 
                      border: "1px solid #333", 
                      minHeight: 300,
                      height: "60vh",
                      maxHeight: 600,
                      overflow: "hidden",
                      position: "relative",
                      background: "#1a1a1a",
                      borderRadius: 8
                    }} 
                  >
                    <iframe 
                      ref={iframeRef}
                      src={template.attachment.url} 
                      width="100%" 
                      height="100%" 
                      title="PDF Viewer" 
                      style={{ border: "none", display: "block" }}
                    />
                  </div>
                </>
              )}

              {/* Download Button */}
              {template.attachment?.type === "pdf" && (
                <div className="mt-3">
                  <div style={{ color: "#FFD700", fontSize: 14, marginBottom: 8 }}>
                    ℹ️ After editing, download the PDF to save your changes
                  </div>
                  <Button 
                    onClick={async () => {
                      if (!template.attachment?.url) return;
                      const link = document.createElement("a");
                      link.href = template.attachment.url;
                      link.download = `${name.replace(/\s+/g, "_") || "time-tracker"}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }} 
                    style={{ ...yellowBtn, width: "100%", maxWidth: "300px" }}
                  >
                    💾 Download PDF
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>

      {/* Annotation Modal */}
      <Modal show={showAnnotModal} onHide={() => setShowAnnotModal(false)} centered>
        <Modal.Header closeButton style={{ background: "#1a1a1a", borderColor: "#333", color: "#fff" }}>
          <Modal.Title>Edit Annotation</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: "#0f0f10", color: "#fff" }}>
          {editingAnnotation && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Text</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editingAnnotation.text}
                  onChange={e => setEditingAnnotation({ ...editingAnnotation, text: e.target.value })}
                  style={{ background: "#0b0b0b", color: "#fff", border: "1px solid #333" }}
                />
              </Form.Group>
              
              <Row>
                <Col xs={12} md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Font Family</Form.Label>
                    <Form.Select
                      value={editingAnnotation.fontFamily || "Tahoma"}
                      onChange={e => setEditingAnnotation({ ...editingAnnotation, fontFamily: e.target.value })}
                      style={{ background: "#0b0b0b", color: "#fff", border: "1px solid #333" }}
                    >
                      <option value="Tahoma">Tahoma</option>
                      <option value="Arial">Arial</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col xs={12} md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Font Color</Form.Label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Form.Control
                        type="color"
                        value={editingAnnotation.fontColor || "#000000"}
                        onChange={e => setEditingAnnotation({ ...editingAnnotation, fontColor: e.target.value })}
                        style={{ width: 60, height: 40, padding: 2, background: "#0b0b0b", border: "1px solid #333" }}
                      />
                      <Form.Control
                        type="text"
                        value={editingAnnotation.fontColor || "#000000"}
                        onChange={e => setEditingAnnotation({ ...editingAnnotation, fontColor: e.target.value })}
                        placeholder="#000000"
                        style={{ background: "#0b0b0b", color: "#fff", border: "1px solid #333", flex: 1 }}
                      />
                    </div>
                  </Form.Group>
                </Col>
              </Row>
              
              <Form.Group className="mb-3">
                <Form.Label>Font Size</Form.Label>
                <Form.Select
                  value={editingAnnotation.fontSize}
                  onChange={e => setEditingAnnotation({ ...editingAnnotation, fontSize: parseInt(e.target.value) })}
                  style={{ background: "#0b0b0b", color: "#fff", border: "1px solid #333" }}
                >
                  <option value="8">8pt</option>
                  <option value="10">10pt</option>
                  <option value="12">12pt</option>
                  <option value="14">14pt</option>
                  <option value="16">16pt</option>
                  <option value="18">18pt</option>
                  <option value="20">20pt</option>
                  <option value="24">24pt</option>
                  <option value="28">28pt</option>
                  <option value="36">36pt</option>
                </Form.Select>
              </Form.Group>
              
              <div style={{ 
                marginTop: 16, 
                padding: 12, 
                background: "#1a1a1a", 
                borderRadius: 4,
                border: "1px solid #333"
              }}>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 8 }}>Preview:</div>
                <div style={{ 
                  fontSize: `${editingAnnotation.fontSize}px`,
                  fontFamily: editingAnnotation.fontFamily || "Tahoma",
                  color: editingAnnotation.fontColor || "#000",
                  background: "#fff",
                  padding: 8,
                  borderRadius: 4,
                  display: "inline-block"
                }}>
                  {editingAnnotation.text || "Edit me"}
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{ background: "#1a1a1a", borderColor: "#333" }}>
          <Button variant="secondary" onClick={() => setShowAnnotModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => editingAnnotation && removeAnnotation(editingAnnotation.id)}>Delete</Button>
          <Button style={yellowBtn} onClick={() => editingAnnotation && saveAnnotationEdit(editingAnnotation)}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};