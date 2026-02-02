"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDistanceToNow } from "date-fns";
import { XMarkIcon, CheckIcon, TrashIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Post {
  id: string;
  title: string;
  body: string;
  author: string;
  author_type?: string | null;
  username?: string | null;
  created_at: string;
  is_deleted?: boolean;
  is_reviewed?: boolean;
  is_resolved?: boolean;
  is_reported?: boolean;
}

export default function AdminCommunityModeration() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const POSTS_PER_PAGE = 10;

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
      return;
    }

    setPosts(data || []);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleToggleSelect = (id: string) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    await Promise.all(
      ids.map((id) =>
        supabase.from("community_posts").update({ is_deleted: true }).eq("id", id)
      )
    );
    await fetchPosts();
    setSelected(new Set());
  };

  const handleMarkReviewed = async (id: string) => {
    await supabase.from("community_posts").update({ is_reviewed: true }).eq("id", id);
    await fetchPosts();
  };

  const handleMarkResolved = async (id: string) => {
    await supabase.from("community_posts").update({ is_resolved: true }).eq("id", id);
    await fetchPosts();
  };

  const filtered = posts.filter((p) => {
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.author.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "reported" && p.is_reported) ||
      (filter === "resolved" && p.is_resolved) ||
      (filter === "unreviewed" && !p.is_reviewed);
    return matchSearch && matchFilter && !p.is_deleted;
  });

  const paginated = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">🛡️ Community Moderation</h1>

      <div className="flex flex-wrap gap-4 items-center mb-6">
        <input
          type="text"
          placeholder="Search by title or author"
          className="border p-2 rounded w-full md:w-auto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="all">All Posts</option>
          <option value="reported">Reported</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="resolved">Resolved</option>
        </select>
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Delete Selected ({selected.size})
          </button>
        )}
      </div>

      <div className="space-y-4">
        {paginated.map((post) => (
          <div
            key={post.id}
            className={cn(
              "p-4 rounded border shadow-sm bg-white",
              selected.has(post.id) && "border-blue-400 bg-blue-50"
            )}
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{post.title}</h2>
                <p className="text-sm text-gray-600 line-clamp-2">{post.body}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {post.author_type === "organization" && post.username ? (
                    <Link href={`/organization/${post.username}`} className="text-indigo-600 hover:underline">
                      @{post.username}
                    </Link>
                  ) : post.author_type === "business" && post.username ? (
                    <Link href={`/business/${post.username}`} className="text-indigo-600 hover:underline">
                      @{post.username}
                    </Link>
                  ) : (
                    <Link href={`/profile/${post.author}`} className="text-indigo-600 hover:underline">
                      @{post.author}
                    </Link>
                  )}
                  <span> • {formatDistanceToNow(new Date(post.created_at))} ago</span>
                </p>
              </div>
              <input
                type="checkbox"
                checked={selected.has(post.id)}
                onChange={() => handleToggleSelect(post.id)}
                className="mt-2"
              />
            </div>
            <div className="flex gap-3 mt-3 text-sm">
              {!post.is_reviewed && (
                <button
                  onClick={() => handleMarkReviewed(post.id)}
                  className="flex items-center gap-1 text-yellow-600 hover:underline"
                >
                  <CheckIcon className="h-4 w-4" /> Mark Reviewed
                </button>
              )}
              {!post.is_resolved && (
                <button
                  onClick={() => handleMarkResolved(post.id)}
                  className="flex items-center gap-1 text-green-600 hover:underline"
                >
                  <CheckIcon className="h-4 w-4" /> Mark Resolved
                </button>
              )}
              <button
                onClick={() => handleBulkDelete()}
                className="flex items-center gap-1 text-red-600 hover:underline"
              >
                <TrashIcon className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-8 flex justify-center gap-4">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
        >
          Prev
        </button>
        <span className="text-sm pt-2">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page * POSTS_PER_PAGE >= filtered.length}
          className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
        >
          Next
        </button>
      </div>
    </div>
  );
}
