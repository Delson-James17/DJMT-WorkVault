import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ListGroup, Card } from 'react-bootstrap';

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

    const path = `file-bank/${user.id}/${Date.now()}-${selectedFile.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('file-bank')
      .upload(path, selectedFile);

    if (uploadErr) {
      console.error(uploadErr);
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
    loadFiles();
  };

  const downloadFile = async (storagePath: string, filename: string) => {
    const { data, error } = await supabase.storage
      .from('file-bank')
      .createSignedUrl(storagePath, 60);

    if (error) {
      console.error(error);
      return;
    }

    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div
      style={{
        background: '#1b1b1b',
        padding: '20px',
        borderRadius: '12px',
        color: 'white',
      }}
    >
      <h3 style={{ color: '#FFD700' }}>📁 File Bank</h3>

      <input
        type="file"
        onChange={onSelectFile}
        style={{ marginTop: '10px', marginBottom: '10px' }}
      />

      {selectedFile && (
        <Button
          onClick={onSaveAttachment}
          style={{
            background: '#FFD700',
            border: 'none',
            color: '#000',
            fontWeight: 'bold',
            marginBottom: '20px',
          }}
        >
          Save Attachment
        </Button>
      )}

      <Card
        style={{
          background: '#222',
          border: '1px solid #333',
          color: 'white',
          marginTop: '20px',
        }}
      >
        <Card.Body>
          <ListGroup variant="flush">
            {files.map((f) => (
              <ListGroup.Item
                key={f.id}
                style={{
                  background: '#1f1f1f',
                  color: '#e0e0e0',
                  border: '1px solid #333',
                }}
                className="d-flex justify-content-between align-items-center"
              >
                <div>{f.filename}</div>

                <Button
                  size="sm"
                  onClick={() => downloadFile(f.storage_path, f.filename)}
                  style={{
                    background: '#FFD700',
                    border: 'none',
                    color: '#000',
                    fontWeight: 'bold',
                  }}
                >
                  Download
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card.Body>
      </Card>
    </div>
  );
};
