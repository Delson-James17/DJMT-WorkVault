// src/components/Editor/TimeTrackerEditor.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../api/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Form, Table, Row, Col, Card, Spinner, Modal } from "react-bootstrap";
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
};

const makeEmptyCell = (): Cell => ({ id: uuidv4(), text: "" });

const defaultTemplate: TemplateData = {
  rows: [[makeEmptyCell(), makeEmptyCell(), makeEmptyCell()]],
  meta: {},
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
  const [pdfNumPages] = useState<number>(0);
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
      Table editor functions
  -------------------------- */
  const addRow = () => {
    const cols = template.rows[0]?.length ?? 3;
    const newRow = Array.from({ length: cols }, () => makeEmptyCell());
    setTemplate(prev => ({ ...prev, rows: [...prev.rows, newRow] }));
  };

  const addCol = () => {
    setTemplate(prev => ({
      ...prev,
      rows: prev.rows.map(row => [...row, makeEmptyCell()]),
    }));
  };

  const removeRow = (rowIdx: number) => {
    if (template.rows.length === 1) {
      if (!confirm("Removing last row will reset template. Continue?")) return;
      setTemplate({ ...defaultTemplate });
      return;
    }
    setTemplate(prev => ({ ...prev, rows: prev.rows.filter((_, i) => i !== rowIdx) }));
  };

  const removeCol = (colIdx: number) => {
    const cols = template.rows[0]?.length ?? 1;
    if (cols <= 1) {
      if (!confirm("Removing last column will reset template. Continue?")) return;
      setTemplate({ ...defaultTemplate });
      return;
    }
    setTemplate(prev => ({
      ...prev,
      rows: prev.rows.map(row => row.filter((_, c) => c !== colIdx)),
    }));
  };

  const updateCell = (r: number, c: number, text: string) => {
    setTemplate(prev => {
      const rows = prev.rows.map(row => row.map(cell => ({ ...cell })));
      rows[r][c].text = text;
      return { ...prev, rows };
    });
  };

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
      const payload = { name, template_data: template, user_id: user.id };
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

          <div style={{ ...panelStyle, marginBottom: 12 }}>
            <Table bordered className="table-sm" style={{ background: "#0b0b0b", color: "#eee" }}>
              <tbody>
                {template.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={cell.id} style={{ background: "#0b0b0b" }}>
                        <Form.Control value={cell.text} onChange={e => updateCell(r, c, e.target.value)} size="sm" style={{ background: "#0b0b0b", color: "#fff", border: "1px solid #222" }} />
                      </td>
                    ))}
                    <td style={{ background: "#0b0b0b" }}>
                      <Button size="sm" variant="danger" onClick={() => removeRow(r)}>Del row</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

              <div>
                <Button onClick={addRow} size="sm" style={{ ...yellowBtn, marginRight: 8 }}>Add Row</Button>
                <Button onClick={addCol} size="sm" style={{ ...yellowBtn, marginRight: 8 }}>Add Col</Button>
                <Button onClick={() => removeCol(template.rows[0].length - 1)} size="sm" style={yellowBtn}>Del Col</Button>
              </div>
                            
          </div>

          {template.attachment?.type === "pdf" && (
            <div ref={pdfContainerRef} style={{ border: "1px solid #333", minHeight: 300, cursor: "crosshair" }} onClick={onPdfClick}>
              <iframe src={template.attachment.url} width="100%" height={400} title="PDF Preview" />
            </div>
          )}

          <div className="mt-3">
            <Button onClick={() => exportPdfWithAnnotations(false)} style={{ ...yellowBtn, marginRight: 8 }}>Download PDF</Button>
            <Button onClick={() => exportPdfWithAnnotations(true)} style={yellowBtn}>Download & Upload Edited PDF</Button>
          </div>

          {/* Annotation modal */}
          <Modal show={showAnnotModal} onHide={() => setShowAnnotModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Edit Annotation</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {editingAnnotation && (
                <Form.Control
                  value={editingAnnotation.text}
                  onChange={e => setEditingAnnotation({ ...editingAnnotation, text: e.target.value })}
                />
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowAnnotModal(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => editingAnnotation && removeAnnotation(editingAnnotation.id)}>Delete</Button>
              <Button variant="primary" onClick={() => editingAnnotation && saveAnnotationEdit(editingAnnotation)}>Save</Button>
            </Modal.Footer>
          </Modal>
        </Card.Body>
      </Card>
    </div>
  );
};
