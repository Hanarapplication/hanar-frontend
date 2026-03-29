'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { User, Trash2, X, ShoppingBag, Building2, Ban, SendHorizontal } from 'lucide-react';
import PostActionsBar from '@/components/PostActionsBar';
import FeedVideoPlayer from '@/components/FeedVideoPlayer';
import { Avatar } from '@/components/Avatar';

type ProfileListing = {
  id: string;
  title: string;
  price: string | number;
  location: string;
  imageUrls: string[];
  created_at?: string | null;
};

type Post = {
  id: string;
  title: string;
  body: string;
  image: string | null;
  video?: string | null;
  user_id: string;
  created_at: string;
  likes_post: number;
  deleted: boolean;
  author_type: string | null;
  username?: string;
  tags?: string[];
  visibility?: 'profile' | 'community';
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  author: string;
  text?: string;
  body?: string;
  created_at: string;
  likes_comment?: number;
  likes?: number;
  user_liked?: boolean;
  author_type?: string;
  profiles?: { profile_pic_url: string | null } | null;
};

type FollowUser = {
  id: string;
  username: string;
  profile_pic_url?: string | null;
  /** For organizations: display name (full_name); for users same as username or handle */
  displayName?: string;
  type: 'user' | 'organization';
  href: string;
};

const userProfileHref = (username: string) => `/profile/${username}`;

const orgProfileHref = (username: string) => `/organization/${username}`;

function getHandleHref(username: string, authorType?: string) {
  const t = (authorType || '').toLowerCase();
  if (t === 'organization') return orgProfileHref(username);
  return userProfileHref(username);
}

const Spinner = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="animate-spin text-indigo-600">
    <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25" fill="currentColor" />
    <path d="M10.72,19.9a8,8,0,0,1-6.5-9.79A7.77,7.77,0,0,1,10.4,4.16a8,8,0,0,1,9.49,6.52A1.54,1.54,0,0,0,21.38,12h.13a1.37,1.37,0,0,0,1.38-1.54,11,11,0,1,0-12.7,12.39A1.5,1.5,0,0,0,12,21.34h0A1.47,1.47,0,0,0,10.72,19.9Z" fill="currentColor" />
  </svg>
);

export default function ProfilePage() {
  const params = useParams();
  const usernameParam = typeof params?.username === 'string' ? params.username : '';
  const router = useRouter();
  const [profile, setProfile] = useState<{ id: string; username: string; displayName?: string | null; profile_pic_url?: string | null; bio?: string | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string | null; displayName: string | null; isIndividual: boolean; isOrganization: boolean } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<FollowUser[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [followingInList, setFollowingInList] = useState<Record<string, boolean>>({});
  const [followTogglingId, setFollowTogglingId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [shopListings, setShopListings] = useState<ProfileListing[]>([]);
  const [shopListingsLoading, setShopListingsLoading] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{
    mutuallyBlocked: boolean;
    iBlockedThem: boolean;
    theyBlockedMe: boolean;
  } | null>(null);
  const [blockActionLoading, setBlockActionLoading] = useState(false);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUser(null);
        setLikedPosts(new Set());
        return;
      }
      const { data: reg } = await supabase.from('registeredaccounts').select('username, full_name, business, organization').eq('user_id', user.id).maybeSingle();
      const [biz, org] = await Promise.all([
        supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle(),
        supabase.from('organizations').select('id').eq('user_id', user.id).maybeSingle(),
      ]);
      const isIndividual = !biz.data && !org.data;
      const isOrganization = !!org.data;
      setCurrentUser({
        id: user.id,
        username: reg?.username || null,
        displayName: reg?.full_name?.trim() || null,
        isIndividual: !!isIndividual,
        isOrganization,
      });
      try {
        const res = await fetch(`/api/community/post/liked?userId=${encodeURIComponent(user.id)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.likedPostIds)) {
          setLikedPosts(new Set(data.likedPostIds));
        }
      } catch {
        setLikedPosts(new Set());
      }
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!usernameParam) return;
      setLoading(true);
      setNotFound(false);
      const handle = String(usernameParam).replace(/^@/, '').toLowerCase();

      try {
        const res = await fetch(`/api/handles/resolve?handle=${encodeURIComponent(handle)}`);
        const result = await res.json();

        if (res.ok && result?.type === 'organization') {
          router.replace(`/organization/${handle}`);
          return;
        }
        if (res.ok && result?.type === 'business') {
          router.replace(`/business/${handle}`);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, profile_pic_url')
          .eq('username', handle)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          const { data: regRow } = await supabase.from('registeredaccounts').select('full_name').eq('user_id', data.id).maybeSingle();
          setProfile({
            id: data.id,
            username: data.username,
            displayName: regRow?.full_name?.trim() || null,
            profile_pic_url: data.profile_pic_url,
            bio: (data as any).bio ?? null,
          });
        } else {
          const { data: regData } = await supabase
            .from('registeredaccounts')
            .select('user_id, full_name')
            .eq('username', handle)
            .maybeSingle();
          if (regData) {
            const { data: profData } = await supabase
              .from('profiles')
              .select('id, username, profile_pic_url')
              .eq('id', regData.user_id)
              .maybeSingle();
            if (profData) {
              setProfile({
                id: profData.id,
                username: profData.username || handle,
                displayName: regData.full_name?.trim() || null,
                profile_pic_url: profData.profile_pic_url,
                bio: (profData as any).bio ?? null,
              });
            } else {
              setProfile({
                id: regData.user_id,
                username: handle,
                displayName: regData.full_name?.trim() || null,
                profile_pic_url: null,
                bio: null,
              });
            }
          } else {
            setNotFound(true);
          }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [usernameParam, router]);

  useEffect(() => {
    const checkFollow = async () => {
      if (!currentUser?.id || !profile?.id) return;
      if (currentUser.id === profile.id) return;

      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profile.id)
        .maybeSingle();

      setIsFollowing(!!data);
    };

    checkFollow();
  }, [currentUser?.id, profile?.id]);

  useEffect(() => {
    const loadFollowCounts = async () => {
      if (!profile?.id) return;
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profile.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile.id),
      ]);
      setFollowerCount(followersRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);
    };
    loadFollowCounts();
  }, [profile?.id]);

  useEffect(() => {
    const loadPosts = async () => {
      if (!profile?.id) return;
      setPostsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      const qs = new URLSearchParams({ userId: profile.id, individualOnly: 'true' });
      if (user?.id) qs.set('viewerUserId', user.id);

      const res = await fetch(`/api/community/posts?${qs.toString()}`);
      const result = await res.json();

      if (res.ok) {
        setPosts(result.posts || []);
        setCommentCounts(result.commentCounts || {});
      }

      setPostsLoading(false);
    };

    loadPosts();
  }, [profile?.id]);

  useEffect(() => {
    const run = async () => {
      if (!currentUser?.id || !profile?.id || currentUser.id === profile.id) {
        setBlockStatus(null);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/user/block-status?otherUserId=${encodeURIComponent(profile.id)}`, {
        credentials: 'include',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBlockStatus({
          mutuallyBlocked: !!data.mutuallyBlocked,
          iBlockedThem: !!data.iBlockedThem,
          theyBlockedMe: !!data.theyBlockedMe,
        });
      } else setBlockStatus(null);
    };
    run();
  }, [currentUser?.id, profile?.id]);

  const loadFollowList = async (kind: 'followers' | 'following') => {
    if (!profile?.id || currentUser?.id !== profile.id) return;
    setListModal(kind);
    setListLoading(true);
    setListUsers([]);
    setFollowingInList({});
    try {
      const isFollowers = kind === 'followers';
      const { data: rows } = await supabase
        .from('follows')
        .select(isFollowers ? 'follower_id' : 'following_id')
        .eq(isFollowers ? 'following_id' : 'follower_id', profile.id);
      const ids = (rows || []).map((r: any) => isFollowers ? r.follower_id : r.following_id).filter(Boolean);
      if (ids.length === 0) {
        setListUsers([]);
        setListLoading(false);
        return;
      }

      const byId: Record<string, FollowUser> = {};

      if (isFollowers) {
        // Followers are always users (only individuals can follow)
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, profile_pic_url')
          .in('id', ids);
        (profilesData || []).forEach((p: any) => {
          byId[p.id] = {
            id: p.id,
            username: p.username || p.id,
            profile_pic_url: p.profile_pic_url,
            type: 'user',
            href: userProfileHref(p.username || p.id),
          };
        });
        const missing = ids.filter((id: string) => !byId[id]);
        if (missing.length > 0) {
          const { data: regData } = await supabase
            .from('registeredaccounts')
            .select('user_id, username')
            .in('user_id', missing);
          (regData || []).forEach((r: any) => {
            if (!byId[r.user_id])
              byId[r.user_id] = {
                id: r.user_id,
                username: r.username || r.user_id,
                type: 'user',
                href: userProfileHref(r.username || r.user_id),
              };
          });
        }
      } else {
        // Following: can be users or organizations
        const [{ data: profilesData }, { data: orgsData }] = await Promise.all([
          supabase.from('profiles').select('id, username, profile_pic_url').in('id', ids),
          supabase.from('organizations').select('user_id, username, full_name, logo_url').in('user_id', ids),
        ]);
        const orgByUserId = new Map((orgsData || []).map((o: any) => [o.user_id, o]));
        for (const id of ids) {
          const org = orgByUserId.get(id);
          if (org) {
            byId[id] = {
              id,
              username: org.username || id,
              profile_pic_url: org.logo_url ?? null,
              displayName: org.full_name?.trim() || undefined,
              type: 'organization',
              href: orgProfileHref(org.username || id),
            };
          }
        }
        (profilesData || []).forEach((p: any) => {
          if (!byId[p.id]) {
            byId[p.id] = {
              id: p.id,
              username: p.username || p.id,
              profile_pic_url: p.profile_pic_url,
              type: 'user',
              href: userProfileHref(p.username || p.id),
            };
          }
        });
        const missing = ids.filter((id: string) => !byId[id]);
        if (missing.length > 0) {
          const { data: regData } = await supabase
            .from('registeredaccounts')
            .select('user_id, username')
            .in('user_id', missing);
          (regData || []).forEach((r: any) => {
            if (!byId[r.user_id])
              byId[r.user_id] = {
                id: r.user_id,
                username: r.username || r.user_id,
                type: 'user',
                href: userProfileHref(r.username || r.user_id),
              };
          });
        }
      }

      const list = ids.map((id: string) => byId[id]).filter(Boolean);
      setListUsers(list);

      // Which of these users does the current user (profile owner) follow?
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profile.id)
        .in('following_id', ids);
      const followingSet: Record<string, boolean> = {};
      (myFollows || []).forEach((r: any) => { followingSet[r.following_id] = true; });
      setFollowingInList(followingSet);
    } catch {
      setListUsers([]);
    } finally {
      setListLoading(false);
    }
  };

  const handleFollowInList = async (userId: string, isCurrentlyFollowing: boolean) => {
    if (!profile?.id || currentUser?.id !== profile.id || followTogglingId) return;
    setFollowTogglingId(userId);
    try {
      if (isCurrentlyFollowing) {
        const res = await fetch('/api/unfollow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: profile.id, following_id: userId }),
        });
        if (res.ok) {
          setFollowingInList((prev) => ({ ...prev, [userId]: false }));
          setFollowingCount((c) => Math.max(0, c - 1));
        }
      } else {
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: profile.id, following_id: userId }),
        });
        if (res.ok) {
          setFollowingInList((prev) => ({ ...prev, [userId]: true }));
          setFollowingCount((c) => c + 1);
        }
      }
    } finally {
      setFollowTogglingId(null);
    }
  };

  const handleBlockToggle = async () => {
    if (!currentUser?.id || !profile?.id || currentUser.id === profile.id || blockActionLoading) return;
    setBlockActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      if (blockStatus?.iBlockedThem) {
        const res = await fetch(`/api/user/blocks?blockedUserId=${encodeURIComponent(profile.id)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err?.error || 'Could not unblock');
          return;
        }
        setBlockStatus({
          mutuallyBlocked: !!blockStatus.theyBlockedMe,
          iBlockedThem: false,
          theyBlockedMe: !!blockStatus.theyBlockedMe,
        });
        const { data: { user } } = await supabase.auth.getUser();
        const qs = new URLSearchParams({ userId: profile.id, individualOnly: 'true' });
        if (user?.id) qs.set('viewerUserId', user.id);
        const pr = await fetch(`/api/community/posts?${qs.toString()}`);
        const result = await pr.json();
        if (pr.ok) {
          setPosts(result.posts || []);
          setCommentCounts(result.commentCounts || {});
        }
      } else {
        const res = await fetch('/api/user/blocks', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ blockedUserId: profile.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err?.error || 'Could not block');
          return;
        }
        setBlockStatus({ mutuallyBlocked: true, iBlockedThem: true, theyBlockedMe: false });
        setPosts([]);
        setCommentCounts({});
        setIsFollowing(false);
      }
    } finally {
      setBlockActionLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!profile?.id || currentUser.id === profile.id) return;
    if (!currentUser.isIndividual && !currentUser.isOrganization) return;
    if (blockStatus?.mutuallyBlocked) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const res = await fetch('/api/unfollow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: currentUser.id, following_id: profile.id }),
        });
        if (res.ok) {
          setIsFollowing(false);
          setFollowerCount((c) => Math.max(0, c - 1));
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data?.error || 'Could not unfollow');
        }
      } else {
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: currentUser.id, following_id: profile.id }),
        });
        if (res.ok) {
          setIsFollowing(true);
          setFollowerCount((c) => c + 1);
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data?.error || 'Could not follow');
        }
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const toggleComments = async (postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });

    if (commentsByPost[postId] || commentsLoading[postId]) return;

    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const params = new URLSearchParams({ postId });
      if (currentUser?.id) params.set('userId', currentUser.id);
      const res = await fetch(`/api/community/comments?${params.toString()}`);
      const result = await res.json();
      if (res.ok) {
        setCommentsByPost((prev) => ({ ...prev, [postId]: result.comments || [] }));
      }
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!currentUser?.id) {
      window.location.href = `/login?redirect=${encodeURIComponent(`/profile/${usernameParam}`)}`;
      return;
    }
    const currentlyLiked = likedPosts.has(postId);
    const delta = currentlyLiked ? -1 : 1;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likes_post: Math.max(0, (p.likes_post || 0) + delta) } : p
      )
    );
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    const method = currentlyLiked ? 'DELETE' : 'POST';
    const url =
      method === 'DELETE'
        ? `/api/community/post/like?post_id=${encodeURIComponent(postId)}`
        : '/api/community/post/like';
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify({ post_id: postId }) : undefined,
      credentials: 'include',
    });
    if (!res.ok && res.status !== 409) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes_post: Math.max(0, (p.likes_post || 0) - delta) } : p
        )
      );
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
    }
  };

  const handleCommentLike = async (postId: string, commentId: string) => {
    if (!currentUser?.id) return;
    const comments = commentsByPost[postId] || [];
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    const currentlyLiked = comment.user_liked ?? false;
    const delta = currentlyLiked ? -1 : 1;
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((c) =>
        c.id === commentId
          ? {
              ...c,
              user_liked: !currentlyLiked,
              likes: Math.max(0, (c.likes ?? c.likes_comment ?? 0) + delta),
              likes_comment: Math.max(0, (c.likes ?? c.likes_comment ?? 0) + delta),
            }
          : c
      ),
    }));
    const method = currentlyLiked ? 'DELETE' : 'POST';
    const url =
      method === 'DELETE'
        ? `/api/community/comments/like?comment_id=${encodeURIComponent(commentId)}&user_id=${encodeURIComponent(currentUser.id)}`
        : '/api/community/comments/like';
    const res = await fetch(url, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify({ comment_id: commentId, user_id: currentUser.id }) : undefined,
    });
    if (!res.ok && res.status !== 409) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) =>
          c.id === commentId
            ? {
                ...c,
                user_liked: currentlyLiked,
                likes: Math.max(0, (c.likes ?? 0) - delta),
                likes_comment: Math.max(0, (c.likes_comment ?? 0) - delta),
              }
            : c
        ),
      }));
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!profile?.id || currentUser?.id !== profile.id) return;
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    setDeletingPost(postId);
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ deleted: true })
        .eq('id', postId)
        .eq('user_id', profile.id);

      if (error) throw error;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      alert('Failed to delete post');
    } finally {
      setDeletingPost(null);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser || !commentInput[postId]?.trim()) return;
    setPostingComment((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          text: commentInput[postId].trim(),
          user_id: currentUser.id,
          username: currentUser.username,
          author: currentUser.displayName || currentUser.username || 'User',
        }),
      });
      const result = await res.json();
      if (res.ok && result.comment) {
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: [result.comment, ...(prev[postId] || [])],
        }));
        setCommentCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
        setCommentInput((prev) => ({ ...prev, [postId]: '' }));
      }
    } finally {
      setPostingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const openShopModal = () => {
    setShopModalOpen(true);
    if (!profile?.id) return;
    setShopListingsLoading(true);
    setShopListings([]);
    fetch(`/api/profile-listings?user_id=${encodeURIComponent(profile.id)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data.listings && Array.isArray(data.listings)) {
          setShopListings(data.listings);
        }
      })
      .finally(() => setShopListingsLoading(false));
  };

  const handleShare = async (postId: string, title: string) => {
    const url = `${window.location.origin}/community/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size={44} />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-center">
          <User className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <h1 className="text-2xl font-bold">Profile Not Found</h1>
          <p className="mt-2 text-slate-500">We couldn&apos;t find a user with that username.</p>
          <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline">Go home</Link>
        </div>
      </div>
    );
  }

  const profilePicUrl = profile.profile_pic_url || null;
  const canFollow =
    (currentUser?.isIndividual || currentUser?.isOrganization) &&
    currentUser.id !== profile.id &&
    !blockStatus?.mutuallyBlocked;
  const showBlockControls =
    currentUser?.id &&
    profile?.id &&
    currentUser.id !== profile.id &&
    (currentUser.isIndividual || currentUser.isOrganization);

  const showFollowBlockRow =
    currentUser?.id &&
    profile?.id &&
    currentUser.id !== profile.id &&
    (currentUser.isIndividual || currentUser.isOrganization) &&
    (canFollow || !!blockStatus?.mutuallyBlocked);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl border-x border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 min-h-screen">
        <div className="px-4 pt-6 pb-6 flex gap-4 sm:gap-6 items-start">
          {/* Avatar */}
          <div className="h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-full border-2 border-amber-400/90 bg-slate-200 shadow-lg dark:border-amber-500/60 dark:bg-gray-700">
            <Avatar
              src={profilePicUrl}
              alt={`@${profile.username}`}
              className="h-full w-full rounded-full"
              unframed
            />
          </div>

          <div className="min-w-0 flex-1 flex flex-col gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{profile.displayName || profile.username}</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-slate-600 dark:text-gray-300">{profile.bio}</p>}

            {/* Followers (public); Following count only visible to owner. Owner can click to see list */}
            <div className="flex gap-4 text-sm text-slate-500 dark:text-gray-400 mt-1">
              {currentUser?.id === profile.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => loadFollowList('followers')}
                    className="hover:underline text-left"
                  >
                    <strong className="font-semibold text-slate-900 dark:text-white">{followerCount}</strong> Followers
                  </button>
                  <button
                    type="button"
                    onClick={() => loadFollowList('following')}
                    className="hover:underline text-left"
                  >
                    <strong className="font-semibold text-slate-900 dark:text-white">{followingCount}</strong> Following
                  </button>
                </>
              ) : (
                <span><strong className="font-semibold text-slate-900 dark:text-white">{followerCount}</strong> Followers</span>
              )}
            </div>

            {/* Actions: Shop (visible to all), Edit (own profile), Follow (only for individuals) */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {currentUser?.id === profile.id && (
                <Link
                  href="/dashboard"
                  className="rounded-full border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  Edit Profile
                </Link>
              )}
              <button
                type="button"
                onClick={openShopModal}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              >
                <ShoppingBag className="h-4 w-4" />
                {currentUser?.id === profile.id ? 'My Shop' : 'Shop'}
              </button>
              {showFollowBlockRow && (
                <div className="inline-flex flex-wrap items-center gap-2">
                  {canFollow && (
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      disabled={followLoading}
                      className={`group rounded-full px-5 py-2 text-sm font-semibold transition ${
                        isFollowing
                          ? 'border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-500/50 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                          : 'bg-black text-white hover:opacity-90 dark:bg-white dark:text-black'
                      }`}
                    >
                      <span className="contents">
                        {followLoading ? (
                          '...'
                        ) : isFollowing ? (
                          <>
                            <span className="group-hover:hidden">Following</span>
                            <span className="hidden group-hover:inline">Unfollow</span>
                          </>
                        ) : (
                          'Follow'
                        )}
                      </span>
                    </button>
                  )}
                  {showBlockControls && (
                    <button
                      type="button"
                      onClick={handleBlockToggle}
                      disabled={blockActionLoading || blockStatus?.theyBlockedMe}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                      title={blockStatus?.theyBlockedMe ? undefined : blockStatus?.iBlockedThem ? 'Unblock' : 'Block'}
                    >
                      <Ban className="h-4 w-4" />
                      {blockStatus?.theyBlockedMe
                        ? 'Blocked'
                        : blockStatus?.iBlockedThem
                          ? 'Unblock'
                          : 'Block'}
                    </button>
                  )}
                </div>
              )}
              {currentUser && currentUser.id !== profile.id && !currentUser.isIndividual && !currentUser.isOrganization && (
                <span className="text-xs text-slate-500 dark:text-gray-400">Only individual and organization accounts can follow.</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 mt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Posts</h2>

          {postsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size={32} />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              No posts yet.
              {currentUser?.id === profile.id && (
                <Link href="/community/post" className="mt-4 block text-indigo-600 hover:underline">
                  Create your first post
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{post.title}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          post.visibility === 'profile'
                            ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        }`}
                      >
                        {post.visibility === 'profile' ? 'Profile' : 'Community'}
                      </span>
                    </div>
                    {currentUser?.id === profile.id && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingPost === post.id}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {post.video ? (
                    <div className="mt-3 overflow-hidden rounded-xl">
                      <FeedVideoPlayer src={post.video} />
                    </div>
                  ) : post.image ? (
                    <div className="mt-3 overflow-hidden rounded-xl">
                      <img src={post.image} alt="" className="block w-full h-auto max-h-[85vh] object-contain" />
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-600 dark:text-gray-300 whitespace-pre-wrap">{post.body}</p>
                  {post.tags && post.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {post.tags.map((tag) => (
                        <span key={tag} className="rounded bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-slate-600 dark:text-gray-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <Link
                      href={`/community/post/${post.id}`}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View post
                    </Link>
                  </div>
                  <PostActionsBar
                    liked={likedPosts.has(post.id)}
                    likesCount={post.likes_post ?? 0}
                    commentCount={commentCounts[post.id] ?? 0}
                    canLike={!!currentUser?.id}
                    onLike={() => handleLikePost(post.id)}
                    onComment={() => toggleComments(post.id)}
                    onShare={() => handleShare(post.id, post.title)}
                    postId={post.id}
                    postTitle={post.title}
                    className="mt-1.5"
                  />
                  {currentUser && (
                    <div className="mt-2 flex items-center gap-2 border-t border-slate-100 dark:border-gray-600 pt-2">
                      <input
                        type="text"
                        value={commentInput[post.id] || ''}
                        onChange={(e) => setCommentInput((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Write a comment..."
                        className="flex-1 rounded-full border border-sky-300 px-4 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200/90 dark:border-sky-400 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-sky-300 dark:focus:ring-sky-400/45 dark:placeholder-gray-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(post.id)}
                        disabled={postingComment[post.id] || !commentInput[post.id]?.trim()}
                        aria-label="Post comment"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-200 disabled:text-sky-100/90 dark:bg-sky-600 dark:hover:bg-sky-500 dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
                      >
                        <SendHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                      </button>
                    </div>
                  )}

                  {expandedPosts.has(post.id) && (
                    <div className="mt-4 border-t border-slate-100 dark:border-gray-600 pt-4">
                      {commentsLoading[post.id] ? (
                        <p className="text-xs text-slate-500 dark:text-gray-400">Loading comments...</p>
                      ) : (
                        <>
                          <div className="space-y-3">
                            {(commentsByPost[post.id] || []).length === 0 && (
                              <p className="text-xs text-slate-500 dark:text-gray-400">Be the first to comment.</p>
                            )}
                            {(commentsByPost[post.id] || []).map((c) => (
                              <div key={c.id} className="rounded-lg border border-amber-400/80 dark:border-amber-500/45 bg-slate-50 dark:bg-gray-700/80 px-3 py-2 text-sm flex gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                  <Avatar
                                    src={c.profiles?.profile_pic_url ? `${c.profiles.profile_pic_url}?t=${Date.now()}` : null}
                                    alt=""
                                    className="w-full h-full rounded-full"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                                    <Link href={getHandleHref(c.username, c.author_type)} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                      {c.author || c.username || 'User'}
                                    </Link>
                                  </p>
                                  <p className="text-sm text-slate-600 dark:text-gray-300">{c.body ?? c.text}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {currentUser?.id && (
                                      <button
                                        type="button"
                                        onClick={() => handleCommentLike(post.id, c.id)}
                                        aria-label={c.user_liked ? 'Unlike comment' : 'Like comment'}
                                        aria-pressed={!!c.user_liked}
                                        className={`inline-flex items-center gap-1 text-xs font-medium transition ${
                                          c.user_liked ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400'
                                        }`}
                                      >
                                        <span aria-hidden>👍</span>
                                        <span className="tabular-nums text-slate-500 dark:text-gray-400">
                                          {c.likes ?? c.likes_comment ?? 0}
                                        </span>
                                      </button>
                                    )}
                                    {!currentUser?.id && (
                                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500">
                                        <span aria-hidden>👍</span>
                                        <span className="tabular-nums">{c.likes ?? c.likes_comment ?? 0}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: My Shop – portal so always in view */}
      {shopModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShopModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={currentUser?.id === profile.id ? 'My Shop' : 'Shop'}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 px-4 py-3 shrink-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                {currentUser?.id === profile.id ? 'My Shop' : `${profile.username}'s Shop`}
              </h2>
              <button
                type="button"
                onClick={() => setShopModalOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 p-4">
              {shopListingsLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size={32} />
                </div>
              ) : shopListings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-800/50 p-8 text-center">
                  <ShoppingBag className="h-10 w-10 mx-auto text-slate-400 dark:text-gray-500 mb-2" />
                  <p className="text-slate-500 dark:text-gray-400">No items listed for sale yet.</p>
                  <Link
                    href="/marketplace/post"
                    onClick={() => setShopModalOpen(false)}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    List an item
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {shopListings.map((listing) => (
                    <Link
                      key={listing.id}
                      href={`/marketplace/individual-${listing.id}`}
                      onClick={() => setShopModalOpen(false)}
                      className="flex flex-col rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:border-slate-300 dark:hover:border-gray-600 transition"
                    >
                      <div className="aspect-square w-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                        <img
                          src={listing.imageUrls[0] || '/placeholder.jpg'}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-4 flex flex-col gap-1.5">
                        <p className="font-semibold text-slate-900 dark:text-white truncate text-[15px] tracking-tight">{listing.title}</p>
                        <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {typeof listing.price === 'number' ? `$${Number(listing.price).toLocaleString()}` : listing.price}
                        </p>
                        {listing.location && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-600/50 dark:text-slate-200 truncate max-w-full">
                            {listing.location}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Followers / Following - portal to body so always in view */}
      {listModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setListModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label={listModal === 'followers' ? 'Followers' : 'Following'}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 px-4 py-3 shrink-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {listModal === 'followers' ? 'Followers' : 'Following'}
              </h2>
              <button
                type="button"
                onClick={() => setListModal(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 p-2">
              {listLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size={32} />
                </div>
              ) : listUsers.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-gray-400 py-8">
                  {listModal === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {listUsers.map((u) => {
                    const isFollowingThem = followingInList[u.id];
                    const isSelf = u.id === profile.id;
                    const label = u.displayName || u.username;
                    return (
                      <li key={u.id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-gray-800 transition">
                        <Link
                          href={u.href}
                          onClick={() => setListModal(null)}
                          className="flex items-center gap-3 min-w-0 flex-1"
                        >
                          <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden">
                            <Avatar src={u.profile_pic_url} alt="" className="h-full w-full rounded-full" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 dark:text-white truncate block">{label}</span>
                            <span className="text-sm text-slate-500 dark:text-gray-400 truncate block">@{u.username}</span>
                          </div>
                        </Link>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleFollowInList(u.id, isFollowingThem);
                            }}
                            disabled={followTogglingId === u.id}
                            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                              isFollowingThem
                                ? 'border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 hover:text-red-600'
                                : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'
                            } disabled:opacity-50`}
                          >
                            {followTogglingId === u.id ? '...' : isFollowingThem ? 'Following' : 'Follow'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
