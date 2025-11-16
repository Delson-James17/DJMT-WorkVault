// src/components/Editor/TimeTrackerEditor.tsx
import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "../../api/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Form, Table, Row, Col } from "react-bootstrap";
import Dropzone from "react-dropzone";
import { v4 as uuidv4 } from "uuid";

import { PdfEditor } from "./PdfEditor";
import { WordEditor } from "./WordEditor";
import { ExcelEditor } from "./ExcelEditor";

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

export const TimeTrackerEditor: React.FC<{ templateId?: string }> = ({ templateId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState<TemplateData>(defaultTemplate);
  const [name, setName] = useState("My Time Tracker");

  // Load template if editing
  const loadTemplate = useCallback(
    async (id: string) => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("templates")
          .select("*")
          .eq("id", id)
          .single();
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

  // Table editor functions
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

const uploadFile = async (file: File, folder: string) => {
  if (!user) throw new Error("Sign in first");

  // Check if bucket exists by trying to list it
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error("Bucket list error:", bucketError);
    throw new Error(`Storage error: ${bucketError.message}`);
  }

  const bucketExists = buckets?.some(b => b.name === folder);
  if (!bucketExists) {
    throw new Error(`Storage bucket "${folder}" not found. Please create it in Supabase dashboard.`);
  }

  const storagePath = `${user.id}/${uuidv4()}-${file.name}`;
  
  const { error: uploadError } = await supabase.storage
    .from(folder)
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(folder).getPublicUrl(storagePath);
  if (!data?.publicUrl) throw new Error("Failed to get public URL");

  // Insert metadata into file_bank
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

  return { storagePath, url: data.publicUrl };
};
  // File upload handler
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
    } catch (err) {
      console.error(err);
      alert(`Failed to upload file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Header image upload
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
      alert(`Failed to upload header image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Save template
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
      alert(`Failed to save template: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Row className="mb-3 align-items-center">
        <Col md={6}>
          <Form.Control value={name} onChange={e => setName(e.target.value)} />
        </Col>
        <Col md={6}>
          <Dropzone onDrop={onDropFile} multiple={false}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                style={{ border: "1px dashed #ccc", padding: 8, borderRadius: 6, cursor: "pointer" }}
              >
                <input {...getInputProps()} />
                {template.attachment ? (
                  <div>Editing: {template.attachment.type.toUpperCase()}</div>
                ) : (
                  <div>Drop PDF/Word/Excel file here (optional)</div>
                )}
              </div>
            )}
          </Dropzone>
        </Col>
      </Row>

      <Row className="mb-2">
        <Col>
          <Dropzone onDrop={onDropHeaderImage} accept={{ "image/*": [] }} multiple={false}>
            {({ getRootProps, getInputProps }) => (
              <div {...getRootProps()} style={{ border: "1px dashed #ccc", padding: 8, borderRadius: 6, cursor: "pointer" }}>
                <input {...getInputProps()} />
                {template.headerImage?.url ? <img src={template.headerImage.url} alt="header" style={{ maxHeight: 80 }} /> : <div>Drop header image here (optional)</div>}
              </div>
            )}
          </Dropzone>
        </Col>
      </Row>

      {/* Table editor */}
      <div style={{ padding: 12, background: "white" }}>
        <Table bordered className="table-sm">
          <tbody>
            {template.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={cell.id}>
                    <Form.Control value={cell.text} onChange={e => updateCell(r, c, e.target.value)} size="sm" />
                  </td>
                ))}
                <td>
                  <Button size="sm" variant="danger" onClick={() => removeRow(r)}>Del row</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Button onClick={addRow} size="sm">Add Row</Button>{" "}
        <Button onClick={addCol} size="sm">Add Col</Button>{" "}
        <Button onClick={() => removeCol((template.rows[0]?.length ?? 1) - 1)} size="sm">Remove last Col</Button>
      </div>

      <div style={{ marginTop: 20 }}>
        {template.attachment?.url && template.attachment.type === "pdf" && <PdfEditor url={template.attachment.url} onSave={() => {}} />}
        {template.attachment?.url && template.attachment.type === "word" && <WordEditor url={template.attachment.url} onSave={() => {}} />}
        {template.attachment?.url && template.attachment.type === "excel" && <ExcelEditor url={template.attachment.url} onSave={() => {}} />}
      </div>

      <Button style={{ marginTop: 20 }} onClick={saveTemplate} disabled={loading}>
        {loading ? "Saving..." : "Save Template"}
      </Button>
    </div>
  );
};