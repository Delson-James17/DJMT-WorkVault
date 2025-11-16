import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ListGroup, Card, Container, Row, Col, Form } from 'react-bootstrap';

interface FileRecord {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  content_type: string | null;
  size: number;
  created_at: string;
}

export const FileBank: React.FC = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('file_bank')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setFiles((data as FileRecord[]) || []);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      await loadFiles();
    };

    run();
  }, [user, loadFiles]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const onSaveAttachment = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    const path = `file-bank/${user.id}/${Date.now()}-${selectedFile.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('file-bank')
      .upload(path, selectedFile);

    if (uploadErr) {
      console.error(uploadErr);
      alert('Upload failed: ' + uploadErr.message);
      setUploading(false);
      return;
    }

    await supabase.from('file_bank').insert({
      user_id: user.id,
      filename: selectedFile.name,
      storage_path: path,
      content_type: selectedFile.type,
      size: selectedFile.size,
    });

    setSelectedFile(null);
    setUploading(false);
    loadFiles();
  };

  const downloadFile = async (storagePath: string, filename: string) => {
    const { data, error } = await supabase.storage
      .from('file-bank')
      .createSignedUrl(storagePath, 60);

    if (error) {
      console.error(error);
      alert('Download failed: ' + error.message);
      return;
    }

    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        background: '#0f0f10',
        minHeight: '100vh',
        padding: '12px',
      }}
    >
      <Container fluid>
        <Card style={{ background: 'transparent', border: 'none', color: '#fff' }}>
          <Card.Body style={{ padding: '12px' }}>
            {/* Header */}
            <Row className="mb-3">
              <Col>
                <h3 style={{ color: '#FFD700', fontWeight: 700, marginBottom: 0 }}>
                  📁 File Bank
                </h3>
                <p style={{ color: '#aaa', fontSize: 14, marginTop: 4 }}>
                  Upload and manage your files
                </p>
              </Col>
            </Row>

            {/* Upload Section */}
            <Row className="mb-3">
              <Col xs={12}>
                <Card style={{ background: '#171717', border: '1px solid #222', borderRadius: 8 }}>
                  <Card.Body>
                    <Form.Group>
                      <Form.Label style={{ color: '#FFD700', fontWeight: 600, marginBottom: 8 }}>
                        Upload New File
                      </Form.Label>
                      <Form.Control
                        type="file"
                        onChange={onSelectFile}
                        style={{
                          background: '#0b0b0b',
                          color: '#fff',
                          border: '1px solid #333',
                          marginBottom: 12,
                        }}
                      />
                      {selectedFile && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>
                            Selected: <span style={{ color: '#fff' }}>{selectedFile.name}</span>
                            <span style={{ marginLeft: 8 }}>({formatFileSize(selectedFile.size)})</span>
                          </div>
                          <Button
                            onClick={onSaveAttachment}
                            disabled={uploading}
                            style={{
                              background: '#FFD700',
                              border: 'none',
                              color: '#000',
                              fontWeight: 600,
                              width: '100%',
                              maxWidth: 200,
                            }}
                          >
                            {uploading ? '⏳ Uploading...' : '💾 Save File'}
                          </Button>
                        </div>
                      )}
                    </Form.Group>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Files List */}
            <Row>
              <Col xs={12}>
                <Card style={{ background: '#171717', border: '1px solid #222', borderRadius: 8 }}>
                  <Card.Body style={{ padding: '12px' }}>
                    <h5 style={{ color: '#FFD700', fontWeight: 600, marginBottom: 12 }}>
                      Your Files ({files.length})
                    </h5>
                    {files.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
                        <div>No files uploaded yet</div>
                      </div>
                    ) : (
                      <ListGroup variant="flush">
                        {files.map((f) => (
                          <ListGroup.Item
                            key={f.id}
                            style={{
                              background: '#0b0b0b',
                              color: '#e0e0e0',
                              border: '1px solid #222',
                              borderRadius: 6,
                              marginBottom: 8,
                              padding: '12px',
                            }}
                          >
                            <Row className="align-items-center g-2">
                              <Col xs={12} md={6}>
                                <div style={{ fontWeight: 600, marginBottom: 4, wordBreak: 'break-word' }}>
                                  📄 {f.filename}
                                </div>
                                <div style={{ fontSize: 12, color: '#888' }}>
                                  {formatFileSize(f.size)} • {formatDate(f.created_at)}
                                </div>
                              </Col>
                              <Col xs={12} md={6} className="text-md-end">
                                <Button
                                  size="sm"
                                  onClick={() => downloadFile(f.storage_path, f.filename)}
                                  style={{
                                    background: '#FFD700',
                                    border: 'none',
                                    color: '#000',
                                    fontWeight: 600,
                                    width: '100%',
                                    maxWidth: 150,
                                  }}
                                >
                                  ⬇️ Download
                                </Button>
                              </Col>
                            </Row>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};