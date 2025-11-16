import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ListGroup } from 'react-bootstrap';

// Strong type for records in file_bank table
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

  // -----------------------------
  // FIX: useCallback so hooks work properly
  // -----------------------------
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

  const fetchFiles = async () => {
    await loadFiles();
  };

  fetchFiles();
}, [user, loadFiles]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const path = `file-bank/${user.id}/${Date.now()}-${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('file-bank')
      .upload(path, file);

    if (uploadErr) {
      console.error(uploadErr);
      return;
    }

    // Insert metadata in file_bank table
    await supabase.from('file_bank').insert({
      user_id: user.id,
      filename: file.name,
      storage_path: path,
      content_type: file.type,
      size: file.size,
    });

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
    <div>
      <input type="file" onChange={onUpload} />

      <ListGroup className="mt-3">
        {files.map((f) => (
          <ListGroup.Item
            key={f.id}
            className="d-flex justify-content-between align-items-center"
          >
            <div>{f.filename}</div>

            <Button size="sm" onClick={() => downloadFile(f.storage_path, f.filename)}>
              Download
            </Button>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
};
