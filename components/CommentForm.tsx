'use client';
import { useState } from 'react';

type Props = {
  parentId: string | null;
  onSubmit: (content: string) => void;
};

export default function CommentForm({ parentId, onSubmit }: Props) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        className="w-full p-2 border rounded text-sm"
        placeholder={parentId ? 'Write a reply...' : 'Write a comment...'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
      />
      <div>
        <button
          type="submit"
          className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700"
        >
          Post
        </button>
      </div>
    </form>
  );
}
