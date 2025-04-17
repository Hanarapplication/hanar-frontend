'use client';
import React, { useState } from 'react';
import CommentForm from './CommentForm';

type Comment = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId: string | null;
  createdAt: string;
};

type Props = {
  comment: Comment;
  allComments: Comment[];
  depth?: number;
  onReplySubmit: (content: string, parentId: string) => void;
};

export default function CommentThread({ comment, allComments, depth = 0, onReplySubmit }: Props) {
  const [replying, setReplying] = useState(false);

  const childComments = allComments.filter(c => c.parentId === comment.id);

  return (
    <div className="mt-4 ml-4 border-l-2 border-gray-200 pl-4">
      <div className="bg-gray-50 p-3 rounded shadow-sm">
        <div className="text-sm text-gray-800 font-medium">👤 {comment.userId}</div>
        <div className="text-sm text-gray-700 mt-1">{comment.content}</div>
        <div className="text-xs text-gray-500 mt-1">{new Date(comment.createdAt).toLocaleString()}</div>
        <button
          onClick={() => setReplying(!replying)}
          className="text-xs text-blue-500 mt-2 hover:underline"
        >
          {replying ? 'Cancel' : 'Reply'}
        </button>

        {replying && (
          <div className="mt-2">
            <CommentForm
              parentId={comment.id}
              onSubmit={(text) => {
                onReplySubmit(text, comment.id);
                setReplying(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Render child replies */}
      <div className="mt-2">
        {childComments.map((child) => (
          <CommentThread
            key={child.id}
            comment={child}
            allComments={allComments}
            depth={depth + 1}
            onReplySubmit={onReplySubmit}
          />
        ))}
      </div>
    </div>
  );
}
