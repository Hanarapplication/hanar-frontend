'use client';

import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/utils/useToast';
import { useParams } from 'next/navigation';

// Interfaces remain the same
interface Reply {
  id: number;
  user: string;
  text: string;
  parentId: number | null;
  identity: string;
  likes: number;
  dislikes: number;
  date: string;
}

interface Post {
  id: any;
  title: string;
  image: string;
  body: string;
  category: string;
  tags: string[];
  username: string;
  language: string;
  date: string;
  likes: number;
  dislikes: number;
}

// Mock data functions and constants remain the same
const getPostById = (id: any): Post => ({
  id,
  title: 'How can I find Halal groceries in Texas?',
  image: 'https://source.unsplash.com/600x400/?halal,market',
  body: 'I just moved here and I’m struggling to find a proper halal grocery store. Any suggestions?',
  category: 'Grocery',
  tags: ['halal', 'texas', 'groceries'],
  username: 'sara_texas',
  language: 'en',
  date: '2025-04-10',
  likes: 12,
  dislikes: 1,
});

const initialReplies: Reply[] = [
  { id: 1, user: 'AliHuston', text: 'Check out Al Medina Market!', parentId: null, identity: 'user', likes: 4, dislikes: 0, date: '2025-04-10' },
  { id: 2, user: 'Anonymous', text: 'There’s one on Main St near the mosque.', parentId: 1, identity: 'anonymous', likes: 2, dislikes: 0, date: '2025-04-10' },
];

const identityColors: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800',
  business: 'bg-green-100 text-green-800',
  anonymous: 'bg-gray-200 text-gray-700',
};

// Hardcoded current user for example purposes
const currentUser = {
  username: 'mehdiToronto',
  hasBusiness: true,
  defaultBusinessName: 'Bolani House',
};


export default function SinglePostPage() {
  const { postId } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [newReply, setNewReply] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [identity, setIdentity] = useState('user');
  const [languageFilter, setLanguageFilter] = useState('auto');
  const [sortOption, setSortOption] = useState<'newest' | 'mostLiked'>('newest');
  const [visibleReplies, setVisibleReplies] = useState(5); // Kept the first declaration
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const { toastMessage, showToast } = useToast();
  const bottomRef = useRef(null); // Kept the first declaration

  // Fetch Post Data
  useEffect(() => {
    // Ensure postId is handled correctly (in case it's an array from dynamic routes)
    const id = Array.isArray(postId) ? postId[0] : postId;
    if (id) {
        const data = getPostById(id);
        setPost(data);
    }
    // Add error handling or loading states if fetching real data
  }, [postId]);

  // Calculate sorted and paginated replies
  const sortedReplies = [...replies].sort((a, b) => { // Kept the first calculation
    if (sortOption === 'mostLiked') return b.likes - a.likes;
    // Ensure date comparison is robust
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  const paginatedReplies = sortedReplies.slice(0, visibleReplies); // Kept the first calculation


  // Intersection Observer for Infinite Scroll
  useEffect(() => { // Kept the first effect
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && visibleReplies < sortedReplies.length) { // Check if more replies exist
          console.log('Loading more replies...');
          setVisibleReplies(prev => prev + 5);
        }
      },
      { threshold: 1 }
    );

    const currentRef = bottomRef.current; // Capture ref value
    if (currentRef) {
        observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef); // Clean up using the captured value
      }
      observer.disconnect();
    };
  }, [bottomRef, visibleReplies, sortedReplies.length]); // Add dependencies


  // Timeout for Delete Confirmation
  useEffect(() => {
    if (confirmDeleteId !== null) {
      const timeout = setTimeout(() => {
        setConfirmDeleteId(null);
      }, 5000); // Auto-cancel after 5 seconds
      return () => clearTimeout(timeout);
    }
  }, [confirmDeleteId]);


  // Handlers
  const handleReplySubmit = () => {
    if (!newReply.trim()) return;
    const replyUser = identity === 'anonymous' ? 'Anonymous' :
                      identity === 'business' ? currentUser.defaultBusinessName :
                      currentUser.username; // Assign correct username based on identity
    const reply: Reply = {
      id: Date.now(), // Using timestamp is okay for client-side demo, real apps need unique IDs
      user: replyUser, // Use the determined username
      text: newReply,
      parentId: replyTo,
      identity,
      likes: 0,
      dislikes: 0,
      date: new Date().toISOString().split('T')[0],
    };
    setReplies(prev => [reply, ...prev]); // Add to the beginning for "newest" default sort
    setNewReply('');
    setReplyTo(null);
    showToast('✅ Reply added!'); // Optional: Confirmation toast
  };

  const handleVote = (id: number, type: 'likes' | 'dislikes') => {
    setReplies(prev => prev.map(r => r.id === id ? { ...r, [type]: r[type] + 1 } : r));
    // Add logic here to prevent multiple votes from the same user if needed
  };

  const handleDelete = (replyId: number) => {
    // Simulate backend delete call here
    setReplies(prev => prev.filter(r => r.id !== replyId));
    showToast('✅ Reply deleted');
    // Log deletion attempt
    fetch('/api/log-deleted-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyId: replyId, deletedBy: currentUser.username }),
    }).catch(error => console.error("Failed to log deletion:", error)); // Basic error handling
    setConfirmDeleteId(null); // Reset confirmation state
  }

  // Recursive Reply Rendering Function
  const renderReplies = (parentId: number | null = null) => {
    // Filter sortedReplies based on parentId *before* applying pagination limits might be needed for deeply nested structures
    // But filtering paginatedReplies ensures we only render children of already visible parents.
    return paginatedReplies
      .filter(r => r.parentId === parentId)
      .map(reply => (
        <div key={reply.id} className="mt-4 ml-4 border-l-2 pl-4 border-gray-200">
          <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-sm">
              {/* Basic avatar placeholder */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold ${identity === 'anonymous' ? 'bg-gray-400' : 'bg-gradient-to-tr from-blue-400 to-purple-400'}`}>
                 {reply.user.substring(0,1).toUpperCase()}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${identityColors[reply.identity]}`}>
                {reply.identity}
              </span>
              <span className="text-gray-600 font-medium">@{reply.user}</span>
              <span className="text-gray-400 text-xs">• {reply.date}</span>
            </div>
            <p className="text-gray-700">{reply.text}</p>
            <div className="flex gap-3 text-sm text-gray-600 mt-1 items-center">
              {/* Delete confirmation logic */}
              {(reply.user === currentUser.username || reply.user === currentUser.defaultBusinessName || reply.identity === 'user' && reply.user === 'You') && ( // Allow deletion if user matches current user/business
                confirmDeleteId === reply.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium">Delete?</span>
                    <button
                      onClick={() => handleDelete(reply.id)}
                      className="text-white bg-red-500 hover:bg-red-600 text-xs px-2 py-0.5 rounded transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-gray-700 bg-gray-200 hover:bg-gray-300 text-xs px-2 py-0.5 rounded transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(reply.id)}
                    className="text-red-500 hover:underline text-xs"
                  >
                    🗑 Delete
                  </button>
                )
              )}
              {/* Voting and Reply buttons */}
              <button onClick={() => handleVote(reply.id, 'likes')} className="hover:text-blue-600 flex items-center gap-1">👍 <span className="text-xs">{reply.likes}</span></button>
              <button onClick={() => handleVote(reply.id, 'dislikes')} className="hover:text-red-600 flex items-center gap-1">👎 <span className="text-xs">{reply.dislikes}</span></button>
              <button onClick={() => setReplyTo(reply.id)} className="text-blue-500 hover:underline text-xs font-medium">Reply</button>
            </div>
          </div>
          {/* Recursively render children */}
          {renderReplies(reply.id)}
        </div>
      ));
  };

  // Loading state
  if (!post) return <div className="p-6 text-center text-gray-500">Loading post...</div>;

  // Determine user language and if post should be displayed
  const userLang = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en';
  const displayPost = languageFilter === 'all' || languageFilter === post.language || (languageFilter === 'auto' && post.language === userLang);

  return (
    <div className="max-w-2xl mx-auto bg-gray-50 p-4 sm:p-6 rounded-xl shadow-md space-y-4 text-sm border border-gray-200 mb-10">
      {/* Post Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-pink-300 to-purple-300 rounded-full flex items-center justify-center text-white font-bold">
              {post.username.substring(0,1).toUpperCase()}
            </div>
            <div className="text-gray-700">
              <span className="font-semibold">@{post.username}</span>
              <span className="text-gray-500 text-xs"> • {post.date}</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mt-2">{post.title}</h1>
        </div>
        {/* Language Filter Dropdown */}
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="text-xs border p-1 rounded bg-white shadow-sm"
          aria-label="Filter posts by language"
        >
          <option value="auto">🌍 Auto ({userLang.toUpperCase()})</option>
          <option value="en">🇺🇸 English</option>
          <option value="fa">🇮🇷 فارسی</option>
          <option value="ar">🇸🇦 العربية</option>
          <option value="tr">🇹🇷 Türkçe</option>
          <option value="ps">🇦🇫 پښتو</option>
          <option value="all">🌐 All Languages</option>
        </select>
      </div>

      {/* Conditional Post Body based on Language Filter */}
      {displayPost ? (
        <>
          {/* Post Content */}
          {post.image && <img src={post.image} alt={post.title || "Post image"} className="rounded-md border w-full object-cover aspect-video mt-2" />}
          <p className="text-gray-800 mt-2 whitespace-pre-wrap">{post.body}</p>

          {/* Tags and Actions */}
          <div className="flex justify-between items-center mt-4 gap-4">
            <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                <span>Tags:</span>
                {post.tags.map(t => <span key={t} className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px]">#{t}</span>)}
            </div>
             <button
               onClick={() => {
                 navigator.clipboard.writeText(`${window.location.origin}/community/${postId}`)
                 showToast('✅ Link copied!');
               }}
               className="text-xs text-blue-600 hover:underline whitespace-nowrap"
             >
               📤 Share post
             </button>
          </div>

          {/* Post Likes/Dislikes (Add actual state/handlers if needed) */}
          <div className="flex gap-4 text-sm text-gray-600 mt-2 border-t pt-3">
            <button onClick={() => alert('Liking posts not implemented yet!')} className="hover:text-blue-600 flex items-center gap-1">👍 <span className="text-xs">{post.likes}</span></button>
            <button onClick={() => alert('Disliking posts not implemented yet!')} className="hover:text-red-600 flex items-center gap-1">👎 <span className="text-xs">{post.dislikes}</span></button>
          </div>

          {/* Reply Input Section */}
          <div className="mt-6 border-t pt-4">
             <h2 className="text-lg font-semibold text-gray-800 mb-3">Replies</h2>
             <div className="flex flex-col gap-1 text-xs text-gray-700 w-full mb-2">
               <label htmlFor="identity-select" className="text-xs font-semibold">Reply as:</label>
               <select
                 id="identity-select"
                 value={identity}
                 onChange={(e) => setIdentity(e.target.value)}
                 className="border p-1 rounded-md bg-white text-sm w-full sm:w-auto"
               >
                 <option value="user">@{currentUser.username} (User)</option>
                 {currentUser.hasBusiness && (
                   <option value="business">@{currentUser.defaultBusinessName} (Business)</option>
                 )}
                 <option value="anonymous">Anonymous</option>
               </select>
               {identity === 'anonymous' && (
                 <div className="text-[11px] text-gray-500 italic mt-1">
                   Anonymous replies may receive less engagement and visibility. Your actions remain logged internally.
                 </div>
               )}
             </div>
             {/* Display "Replying to" indicator */}
             {replyTo !== null && (
               <div className="text-xs text-gray-600 italic mb-1 flex justify-between items-center bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                 <span>Replying to @{replies.find(r => r.id === replyTo)?.user || '...'}</span>
                 <button
                   onClick={() => setReplyTo(null)}
                   className="text-red-500 text-xs ml-2 hover:underline font-semibold"
                   aria-label="Cancel reply"
                 >
                   ✖ Cancel
                 </button>
                 {/* Removed duplicate text here */}
               </div>
             )}
             {/* Reply Textarea */}
             <textarea
               className="w-full p-3 bg-white border border-gray-300 rounded-xl mb-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
               placeholder={replyTo ? `Write your reply to @${replies.find(r => r.id === replyTo)?.user || '...'}...` : 'Write a reply...'}
               value={newReply}
               onChange={(e) => setNewReply(e.target.value)}
               rows={3}
               aria-label="Reply input"
             />
             <div className="flex justify-start">
               <button
                 onClick={handleReplySubmit}
                 className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                 disabled={!newReply.trim()} // Disable button if textarea is empty
               >
                 Post Reply
               </button>
             </div>
           </div>


          {/* Replies Section */}
          <div className="mt-6 border-t pt-4">
            <div className="mb-3 flex justify-end">
              {/* Sort Options Dropdown */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as 'newest' | 'mostLiked')}
                className="border text-xs px-2 py-1 rounded bg-white shadow-sm"
                aria-label="Sort replies"
              >
                <option value="newest">🆕 Newest</option>
                <option value="mostLiked">👍 Most Liked</option>
              </select>
            </div>
            {/* Render Replies */}
            {paginatedReplies.length > 0 ? renderReplies() : <p className="text-gray-500 text-sm italic">No replies yet. Be the first!</p> }

            {/* Infinite Scroll Trigger / Loading Indicator */}
            {visibleReplies < sortedReplies.length && (
                 <div ref={bottomRef} className="h-12 mt-6 flex justify-center items-center text-xs text-gray-400">
                    Loading more replies...
                </div>
            )}
          </div>

        </>
      ) : (
        // Message shown when post is filtered out
        <div className="text-sm text-gray-600 italic mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            This post is currently hidden because it doesn't match your selected language filter ('{languageFilter.toUpperCase()}'). Change the filter to '🌐 All Languages' or '{post.language.toUpperCase()}' to view it.
        </div>
      )}

       {/* Toast Message Display (kept only one instance) */}
       {toastMessage && (
         <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
           {toastMessage}
         </div>
       )}
    </div>
  );
}