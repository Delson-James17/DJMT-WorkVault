import React, { useState } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

interface WordEditorProps {
  url?: string;
  onSave: (docBytes: Uint8Array) => void;
}

export const WordEditor: React.FC<WordEditorProps> = ({ onSave }) => {
  const [text, setText] = useState("");

  const addTextToWord = async () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [new Paragraph({ children: [new TextRun(text)] })],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    onSave(await blob.arrayBuffer().then((b: ArrayBuffer) => new Uint8Array(b)));
    saveAs(blob, "edited.docx");
  };

  return (
    <div>
      <h4>Word Editor</h4>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add text to Word"
        style={{ width: "100%", height: 100 }}
      />
      <button onClick={addTextToWord}>Add Text & Save</button>
    </div>
  );
};
