'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef, ChangeEvent, FormEvent, FC } from 'react';
import { UploadCloud, Image as ImageIcon, Instagram, Facebook, Globe, Send, Save, Bell, X, Building, Mail, MapPin, Phone, Tag, Edit, Trash2, Calendar, Eye, Megaphone, User, Building2 } from 'lucide-react';
import { DashboardBurgerMenu } from '@/components/DashboardBurgerMenu';
import { supabase } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/imageCompression';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { spokenLanguagesWithDialects, predefinedLanguageCodes } from '@/utils/languages';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';

// --- TYPE DEFINITIONS ---
type OrgProfile = {
  id?: string;
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  banner_url?: string | null;
  logo_url?: string | null;
  mission?: string | null;
  address?: string | null;
  socials?: {
    website?: string;
    facebook?: string;
    instagram?: string;
  } | null;
  contact_info?: {
    phone?: string;
    whatsapp?: string;
    email?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
};

type Post = {
  id: string;
  title: string;
  body: string;
  image: string | null;
  author: string;
  user_id: string;
  org_id?: string;
  created_at: string;
  likes_post: number;
  deleted: boolean;
  author_type: string;
  user_liked?: boolean;
  tags?: string[];
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  author: string;
  author_type?: string | null;
  body: string;
  text?: string;
  created_at: string;
  parent_id: string | null;
  likes: number;
  likes_comment?: number;
  user_liked?: boolean;
  profiles?: {
    profile_pic_url: string | null;
  };
};

type CommentSort = 'newest' | 'popular';

type NotificationType = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

type FavoriteItem = {
  key: string;
  id: string;
  source: 'retail' | 'dealership' | 'individual';
  slug: string;
  title: string;
  price: string | number;
  image: string;
  location?: string;
};

// Add new type for modal state
type ModalState = {
  isOpen: boolean;
  type: 'create-post' | 'delete-confirm' | null;
  postId?: string;
};

type FollowListItem = {
  id: string;
  username: string;
  profile_pic_url?: string | null;
  displayName?: string;
  type: 'user' | 'organization';
  href: string;
};

const userProfileHref = (username: string) => `/profile/${username}`;
const orgProfileHref = (username: string) => `/organization/${username}`;

// --- UI HELPER COMPONENTS ---
const Spinner: FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={`animate-spin text-indigo-600 ${className || ''}`}
  >
    <path
      d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
      opacity=".25"
      fill="currentColor"
    />
    <path
      d="M10.72,19.9a8,8,0,0,1-6.5-9.79A7.77,7.77,0,0,1,10.4,4.16a8,8,0,0,1,9.49,6.52A1.54,1.54,0,0,0,21.38,12h.13a1.37,1.37,0,0,0,1.38-1.54,11,11,0,1,0-12.7,12.39A1.5,1.5,0,0,0,12,21.34h0A1.47,1.47,0,0,0,10.72,19.9Z"
      fill="currentColor"
    />
  </svg>
);

const Notification: FC<NotificationType & { onDismiss: () => void }> = ({ message, type, onDismiss }) => (
  <div
    className={`p-4 rounded-lg shadow-lg max-w-sm w-full bg-white border-l-4 ${
      type === 'success' ? 'border-green-500' : type === 'info' ? 'border-blue-500' : 'border-red-500'
    }`}
  >
    <div className="flex items-start">
      <div className="flex-1">
        <p
          className={`text-sm font-medium ${
            type === 'success' ? 'text-green-800' : type === 'info' ? 'text-blue-800' : 'text-red-800'
          }`}
        >
          {message}
        </p>
      </div>
      <button onClick={onDismiss} className="ml-4 text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const Card: FC<{ children: React.ReactNode; className?: string; id?: string }> = ({ children, className, id }) => (
  <div id={id} className={`bg-white rounded-xl shadow-sm p-6 ${className || ''}`}>
    {children}
  </div>
);

export default function OrganizationDashboard() {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [mission, setMission] = useState('');
  const [address, setAddress] = useState('');
  const [socials, setSocials] = useState({ instagram: '', facebook: '', website: '' });
  const [contact, setContact] = useState({
    phone: '',
    whatsapp: '',
    email: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postTags, setPostTags] = useState('');
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, type: null });
  const [postPreview, setPostPreview] = useState<{
    title: string;
    body: string;
    tags: string[];
    image: string | null;
  } | null>(null);
  const [deletingPost, setDeletingPost] = useState<boolean>(false);
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({});
  const [commentContent, setCommentContent] = useState<{ [key: string]: string }>({});
  const [commentSort, setCommentSort] = useState<'newest' | 'popular'>('newest');
  const [postingComment, setPostingComment] = useState<{ [key: string]: boolean }>({});
  const [likingComment, setLikingComment] = useState<{ [key: string]: boolean }>({});
  const [deletingComment, setDeletingComment] = useState<{ [key: string]: boolean }>({});
  const [userLikedPosts, setUserLikedPosts] = useState<Set<string>>(new Set());
  const [userLikedComments, setUserLikedComments] = useState<Set<string>>(new Set());
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<FollowListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [followingInList, setFollowingInList] = useState<Record<string, boolean>>({});
  const [followTogglingId, setFollowTogglingId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Array<{
    id: string;
    business_name: string | null;
    slug: string | null;
    category: string | null;
    subcategory?: string | null;
    logo_url?: string | null;
    address?: { city?: string; state?: string } | null;
  }>>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [followedOrgs, setFollowedOrgs] = useState<Array<{
    user_id: string;
    full_name: string | null;
    username: string | null;
    logo_url?: string | null;
  }>>([]);
  const [followedOrgsLoading, setFollowedOrgsLoading] = useState(true);
  const [burgerMenuOpen, setBurgerMenuOpen] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [newLanguageInput, setNewLanguageInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const usernameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add form state for profile editing
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    mission: '',
    address: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    address_lat: null as number | null,
    address_lng: null as number | null,
    banner_url: '',
    logo_url: '',
    phone: '',
    whatsapp: '',
    instagram: '',
    facebook: '',
    website: '',
    spoken_languages: [] as string[],
  });

  const router = useRouter();
  
  const ORG_STORAGE = {
    bucket: 'organizations',
    logoFolder: 'logo',
    bannerFolder: 'banner',
    postFolder: 'posts'
  };

  const addNotification = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  // Fetch Organization Profile from organizations table
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        let { data: { session } } = await supabase.auth.getSession();
        let user = session?.user;
        if (!user) {
          await new Promise((r) => setTimeout(r, 200));
          const retry = await supabase.auth.getSession();
          session = retry.data.session;
          user = session?.user;
        }
        if (!user) {
          router.push('/login');
          return;
        }

        // Verify user is an organization account before loading org data
        const { data: regProfile } = await supabase
          .from('registeredaccounts')
          .select('organization')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!regProfile?.organization) {
          router.replace('/dashboard');
          return;
        }

        let { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (error) throw error;
        if (data) {
          setProfile(data);
          setForm({
            full_name: data.full_name || '',
            username: data.username || '',
            email: data.email || '',
            mission: data.mission || '',
            address: data.address || '',
            address_city: (data as any).address_city ?? '',
            address_state: (data as any).address_state ?? '',
            address_zip: (data as any).address_zip ?? '',
            address_lat: (data as any).address_lat ?? null,
            address_lng: (data as any).address_lng ?? null,
            banner_url: data.banner_url || '',
            logo_url: data.logo_url || '',
            phone: data.contact_info?.phone || '',
            whatsapp: data.contact_info?.whatsapp || '',
            instagram: data.socials?.instagram || '',
            facebook: data.socials?.facebook || '',
            website: data.socials?.website || '',
            spoken_languages: Array.isArray(data.spoken_languages) ? data.spoken_languages : [],
          });
          setMission(data.mission || '');
          setAddress(data.address || '');
          setContact(data.contact_info || { phone: '', whatsapp: '', email: '' });
          setSocials(data.socials || { instagram: '', facebook: '', website: '' });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        addNotification('Could not load organization profile.', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  useEffect(() => {
    const loadFollowCounts = async () => {
      if (!profile?.user_id) return;
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profile.user_id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile.user_id),
      ]);
      setFollowerCount(followersRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);
    };

    loadFollowCounts();
  }, [profile?.user_id]);

  const loadFollowList = async (kind: 'followers' | 'following') => {
    if (!profile?.user_id) return;
    setListModal(kind);
    setListLoading(true);
    setListUsers([]);
    setFollowingInList({});
    try {
      const isFollowers = kind === 'followers';
      const { data: rows } = await supabase
        .from('follows')
        .select(isFollowers ? 'follower_id' : 'following_id')
        .eq(isFollowers ? 'following_id' : 'follower_id', profile.user_id);
      const ids = (rows || []).map((r: { follower_id?: string; following_id?: string }) =>
        isFollowers ? r.follower_id : r.following_id
      ).filter(Boolean) as string[];
      if (ids.length === 0) {
        setListLoading(false);
        return;
      }

      const byId: Record<string, FollowListItem> = {};
      if (isFollowers) {
        const [{ data: profilesData }, { data: orgsData }] = await Promise.all([
          supabase.from('profiles').select('id, username, profile_pic_url').in('id', ids),
          supabase.from('organizations').select('user_id, username, full_name, logo_url').in('user_id', ids),
        ]);
        const orgByUserId = new Map((orgsData || []).map((o: { user_id: string }) => [o.user_id, o]));
        for (const id of ids) {
          const org = orgByUserId.get(id) as { username: string; full_name?: string; logo_url?: string } | undefined;
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
        (profilesData || []).forEach((p: { id: string; username?: string; profile_pic_url?: string }) => {
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
        const missing = ids.filter((id) => !byId[id]);
        if (missing.length > 0) {
          const { data: regData } = await supabase
            .from('registeredaccounts')
            .select('user_id, username')
            .in('user_id', missing);
          (regData || []).forEach((r: { user_id: string; username?: string }) => {
            if (!byId[r.user_id]) {
              byId[r.user_id] = {
                id: r.user_id,
                username: r.username || r.user_id,
                type: 'user',
                href: userProfileHref(r.username || r.user_id),
              };
            }
          });
        }
      } else {
        const [{ data: profilesData }, { data: orgsData }] = await Promise.all([
          supabase.from('profiles').select('id, username, profile_pic_url').in('id', ids),
          supabase.from('organizations').select('user_id, username, full_name, logo_url').in('user_id', ids),
        ]);
        const orgByUserId = new Map((orgsData || []).map((o: { user_id: string }) => [o.user_id, o]));
        for (const id of ids) {
          const org = orgByUserId.get(id) as { username: string; full_name?: string; logo_url?: string } | undefined;
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
        (profilesData || []).forEach((p: { id: string; username?: string; profile_pic_url?: string }) => {
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
        const missing = ids.filter((id) => !byId[id]);
        if (missing.length > 0) {
          const { data: regData } = await supabase
            .from('registeredaccounts')
            .select('user_id, username')
            .in('user_id', missing);
          (regData || []).forEach((r: { user_id: string; username?: string }) => {
            if (!byId[r.user_id]) {
              byId[r.user_id] = {
                id: r.user_id,
                username: r.username || r.user_id,
                type: 'user',
                href: userProfileHref(r.username || r.user_id),
              };
            }
          });
        }
      }

      setListUsers(ids.map((id) => byId[id]).filter(Boolean));

      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profile.user_id)
        .in('following_id', ids);
      const followingSet: Record<string, boolean> = {};
      (myFollows || []).forEach((r: { following_id: string }) => { followingSet[r.following_id] = true; });
      setFollowingInList(followingSet);
    } catch {
      setListUsers([]);
    } finally {
      setListLoading(false);
    }
  };

  const handleFollowInList = async (userId: string, isCurrentlyFollowing: boolean) => {
    if (!profile?.user_id || followTogglingId) return;
    setFollowTogglingId(userId);
    try {
      if (isCurrentlyFollowing) {
        const res = await fetch('/api/unfollow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: profile.user_id, following_id: userId }),
        });
        if (res.ok) {
          setFollowingInList((prev) => ({ ...prev, [userId]: false }));
          setFollowingCount((c) => Math.max(0, c - 1));
        }
      } else {
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: profile.user_id, following_id: userId }),
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

  useEffect(() => {
    const loadFavoritesAndOrgs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setFavorites([]);
          setFollowedOrgs([]);
          return;
        }

        const { data: favoriteRows, error: favoritesError } = await supabase
          .from('business_favorites')
          .select('business_id')
          .eq('user_id', user.id);

        if (favoritesError) throw favoritesError;

        const businessIds = (favoriteRows || []).map((row: { business_id: string }) => row.business_id);
        if (businessIds.length === 0) {
          setFavorites([]);
        } else {
          const { data, error } = await supabase
            .from('businesses')
            .select('id, business_name, slug, category, subcategory, logo_url, address')
            .in('id', businessIds);

          if (error) throw error;
          setFavorites((data as any[]) || []);
        }

        const { data: followRows, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (followError) throw followError;

        const orgOwnerIds = (followRows || []).map((row: { following_id: string }) => row.following_id);
        if (orgOwnerIds.length === 0) {
          setFollowedOrgs([]);
        } else {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('user_id, full_name, username, logo_url')
            .in('user_id', orgOwnerIds);

          if (orgError) throw orgError;
          setFollowedOrgs((orgData as any[]) || []);
        }

        const { data: favRows } = await supabase
          .from('user_marketplace_favorites')
          .select('item_key, item_snapshot')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        const items = (favRows || []).map((r: { item_key: string; item_snapshot: Record<string, unknown> }) => ({
          key: r.item_key,
          id: (r.item_snapshot?.id as string) ?? '',
          source: (r.item_snapshot?.source as 'retail' | 'dealership' | 'individual') ?? 'individual',
          slug: (r.item_snapshot?.slug as string) ?? '',
          title: (r.item_snapshot?.title as string) ?? '',
          price: (r.item_snapshot?.price as string | number) ?? '',
          image: (r.item_snapshot?.image as string) ?? '',
          location: (r.item_snapshot?.location as string) ?? '',
        }));
        setFavoriteItems(items);
      } catch (err) {
        console.error('Failed to load favorites/organizations', err);
      } finally {
        setFavoritesLoading(false);
        setFollowedOrgsLoading(false);
      }
    };

    loadFavoritesAndOrgs();
  }, []);

  const removeFavoriteItem = async (itemKey: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_marketplace_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('item_key', itemKey);
    if (error) return;
    setFavoriteItems((prev) => prev.filter((fav) => fav.key !== itemKey));
  };

  // Load user liked posts from community_post_likes table
  useEffect(() => {
    if (!profile?.user_id) return;
    const fetchLikedPosts = async () => {
      try {
        const res = await fetch(`/api/community/post/liked?userId=${encodeURIComponent(profile.user_id)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.likedPostIds)) {
          setUserLikedPosts(new Set(data.likedPostIds));
        }
      } catch {
        setUserLikedPosts(new Set());
      }
    };
    fetchLikedPosts();
  }, [profile?.user_id]);

  // Function to load posts
  const loadPosts = async () => {
    if (!profile?.user_id) return;
    setPostsLoading(true);
    try {
      // Get the current authenticated user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      console.log('Loading posts for user ID:', user.id);
      console.log('Profile user_id:', profile.user_id);
      
      // First, let's check if the table exists and what data is in it
      console.log('Checking all posts in community_posts table...');
      const { data: allPosts, error: allPostsError } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (allPostsError) {
        console.error('Error fetching all posts:', allPostsError);
      } else {
        console.log('All posts in table (last 10):', allPosts);
      }

      // Fetch posts with the auth user ID (since new posts are created with this ID)
      let { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('author_type', 'organization')
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching organization posts with auth user ID:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Raw organization posts data from database:', data);
      console.log('Number of posts found:', data?.length || 0);

      const postList = data || [];
      const postIds = postList.map((p: { id: string }) => p.id);
      let likeCounts: Record<string, number> = {};
      if (postIds.length > 0) {
        try {
          const countsRes = await fetch(`/api/community/post/counts?postIds=${postIds.join(',')}`);
          const res = await countsRes.json();
          likeCounts = res.counts || {};
        } catch {
          // keep original likes_post
        }
      }

      const processedPosts: Post[] = postList.map((post: Post) => ({
        ...post,
        likes_post: likeCounts[post.id] ?? post.likes_post ?? 0,
        user_liked: userLikedPosts.has(post.id)
      }));

      console.log('Processed posts:', processedPosts);
      setPosts(processedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      addNotification('Failed to fetch posts.', 'error');
    } finally {
      setPostsLoading(false);
    }
  };



  // Update useEffect to fetch posts with likes
  useEffect(() => {
    if (profile?.user_id) loadPosts();
  }, [profile?.user_id, userLikedPosts]);
  
  // Handle Image Previews
  useEffect(() => {
      if (bannerFile) {
          const objectUrl = URL.createObjectURL(bannerFile);
          setBannerPreview(objectUrl);
          return () => URL.revokeObjectURL(objectUrl);
      }
  }, [bannerFile]);

  useEffect(() => {
      if (logoFile) {
          const objectUrl = URL.createObjectURL(logoFile);
          setLogoPreview(objectUrl);
          return () => URL.revokeObjectURL(objectUrl);
      }
  }, [logoFile]);

  // Username availability check (debounced)
  useEffect(() => {
    const raw = (form.username || '').trim().toLowerCase().replace(/^@/, '');
    if (raw === (profile?.username || '').toLowerCase()) {
      setUsernameStatus('idle');
      return;
    }
    if (raw.length < 3) {
      setUsernameStatus(raw.length === 0 ? 'idle' : 'invalid');
      return;
    }
    if (raw.length > 30 || !/^[a-z0-9_.]+$/.test(raw)) {
      setUsernameStatus('invalid');
      return;
    }
    if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    setUsernameStatus('checking');
    usernameCheckRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/account/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: raw, excludeOrgUserId: profile?.user_id }),
        });
        const data = await res.json().catch(() => ({}));
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
      usernameCheckRef.current = null;
    }, 400);
    return () => {
      if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    };
  }, [form.username, profile?.user_id, profile?.username]);

  useEffect(() => {
      if (postImage) {
          const objectUrl = URL.createObjectURL(postImage);
          setPostImagePreview(objectUrl);
          return () => URL.revokeObjectURL(objectUrl);
      }
  }, [postImage]);

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!profile?.user_id) {
      addNotification('Missing profile user_id. Please re-login.', 'error');
      return;
    }
    const rawUsername = (form.username || '').trim().toLowerCase().replace(/^@/, '');
    if (rawUsername.length > 0 && (rawUsername.length < 3 || rawUsername.length > 30 || !/^[a-z0-9_.]+$/.test(rawUsername))) {
      addNotification('Username must be 3–30 characters: letters, numbers, underscores, periods.', 'error');
      return;
    }
    if (rawUsername.length >= 3 && usernameStatus === 'taken') {
      addNotification('That username is already taken. Choose another.', 'error');
      return;
    }

    setSavingProfile(true);

    let logo_url = form.logo_url || '';
    let banner_url = form.banner_url || '';

    const uploadFile = async (file: File, folder: string) => {
      // IMPORTANT: must be ORG UUID (organizations.id), NOT user_id
      const orgId = profile.id;
      if (!orgId) throw new Error('Missing organization id (organizations.id).');

      const isLogo = folder === ORG_STORAGE.logoFolder;
      const compressed = await compressImage(file, isLogo ? {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 512,
        initialQuality: 0.85,
      } : {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        initialQuality: 0.82,
      });
      const safeName = compressed.name.replace(/\s+/g, '-');
      const filePath = `${orgId}/${folder}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(ORG_STORAGE.bucket)
        .upload(filePath, compressed, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(ORG_STORAGE.bucket)
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    };

    try {
      if (logoFile) logo_url = await uploadFile(logoFile, ORG_STORAGE.logoFolder);
      if (bannerFile) banner_url = await uploadFile(bannerFile, ORG_STORAGE.bannerFolder);

      const updatedProfile: Record<string, unknown> = {
        user_id: profile.user_id,
        full_name: (form.full_name || '').trim(),
        username: rawUsername || null,
        email: form.email,
        mission: form.mission,
        address: form.address,
        banner_url,
        logo_url,
        ...(form.address_city ? { address_city: form.address_city } : {}),
        ...(form.address_state ? { address_state: form.address_state } : {}),
        ...(form.address_zip ? { address_zip: form.address_zip } : {}),
        ...(form.address_lat != null ? { address_lat: form.address_lat } : {}),
        ...(form.address_lng != null ? { address_lng: form.address_lng } : {}),
        contact_info: {
          phone: form.phone,
          email: form.email,
          whatsapp: form.whatsapp,
        },
        socials: {
          instagram: form.instagram,
          facebook: form.facebook,
          website: form.website,
        },
        spoken_languages: form.spoken_languages?.length ? form.spoken_languages : [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('organizations')
        .upsert([updatedProfile], { onConflict: 'user_id' });

      if (error) throw error;

      const { data: fresh, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('user_id', profile.user_id)
        .single();

      if (fetchError) throw fetchError;

      setProfile(fresh);
      setForm({
        full_name: fresh.full_name || '',
        username: fresh.username || '',
        email: fresh.email || '',
        mission: fresh.mission || '',
        address: fresh.address || '',
        address_city: (fresh as any).address_city ?? '',
        address_state: (fresh as any).address_state ?? '',
        address_zip: (fresh as any).address_zip ?? '',
        address_lat: (fresh as any).address_lat ?? null,
        address_lng: (fresh as any).address_lng ?? null,
        banner_url: fresh.banner_url || '',
        logo_url: fresh.logo_url || '',
        phone: fresh.contact_info?.phone || '',
        whatsapp: fresh.contact_info?.whatsapp || '',
        instagram: fresh.socials?.instagram || '',
        facebook: fresh.socials?.facebook || '',
        website: fresh.socials?.website || '',
        spoken_languages: Array.isArray(fresh.spoken_languages) ? fresh.spoken_languages : [],
      });

      // clear local files after success
      setLogoFile(null);
      setBannerFile(null);

      addNotification('Profile saved successfully.', 'success');
    } catch (err: any) {
      console.error('Save failed:', err);
      addNotification(err?.message || 'Save failed.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const sendNotificationToMembers = async () => {
    if (!profile?.user_id) return;
    const title = notificationTitle.trim();
    const body = notificationBody.trim();
    if (!title || !body) {
      addNotification('Title and message are required.', 'error');
      return;
    }
    if (title.length > 140 || body.length > 1000) {
      addNotification('Title max 140 chars, body max 1000 chars.', 'error');
      return;
    }
    try {
      setSendingNotification(true);
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';
      const res = await fetch('/api/notifications/organization-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          orgUserId: profile.user_id,
          title,
          body,
          url: profile.username ? `/organization/${profile.username}` : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to send notification');
      const sentCount = Number(data.sent || 0);
      if (sentCount === 0) {
        addNotification('Notification saved, but you have no followers yet.', 'info');
      } else {
        addNotification(`Notification sent to ${sentCount} members.`, 'success');
      }
      setNotificationTitle('');
      setNotificationBody('');
      setNotificationModalOpen(false);
    } catch (err: any) {
      addNotification(err?.message || 'Failed to send notification', 'error');
    } finally {
      setSendingNotification(false);
    }
  };

  const handlePostPreview = () => {
    if (!postTitle || !postBody) return;
    
    setPostPreview({
      title: postTitle,
      body: postBody,
      tags: postTags ? postTags.split(',').map(tag => tag.trim()) : [],
      image: postImagePreview
    });
  };

  const handlePostDelete = () => {
    setPostPreview(null);
    setPostTitle('');
    setPostBody('');
    setPostTags('');
    setPostImage(null);
    setPostImagePreview(null);
  };

  const handleDeletePost = async (postId: string) => {
    if (!profile) return;
    setDeletingPost(true);

    try {
      // Get the current authenticated user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Remove the 'new-' prefix if it exists
      const actualPostId = postId.replace('new-', '');
      
      const { error: deleteError } = await supabase
        .from('community_posts')
        .update({ deleted: true })
        .eq('id', actualPostId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting post:', deleteError);
        throw deleteError;
      }

      // Remove the post from the local state
      setPosts(prev => prev.filter(post => post.id !== postId));
      addNotification('Post deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting post:', error);
      addNotification('Error deleting post.', 'error');
    } finally {
      setDeletingPost(false);
    }
  };

  const handlePublishPost = async () => {
    if (!profile || !postPreview) return;
    setPosting(true);

    try {
      // Get the current authenticated user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      console.log('Starting post creation...');
      console.log('Profile:', profile);
      console.log('Post preview:', postPreview);

      let imageUrl = null;
      if (postImage) {
        console.log('Uploading image...');
        const compressed = await compressImage(postImage, {
          maxSizeMB: 0.7,
          maxWidthOrHeight: 1600,
          initialQuality: 0.82,
        });
        const fileExt = compressed.name.split('.').pop();
        const orgId = profile.id || profile.user_id;
        const fileName = `${orgId}/${ORG_STORAGE.postFolder}/post-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(ORG_STORAGE.bucket)
          .upload(fileName, compressed);

        if (uploadError) {
          console.error('Image upload error:', uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(ORG_STORAGE.bucket)
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
        console.log('Image uploaded successfully:', imageUrl);
      }

      const postData = {
        title: postPreview.title,
        body: postPreview.body,
        image: imageUrl,
        author: profile.full_name,
        user_id: user.id,
        org_id: profile.id,
        created_at: new Date().toISOString(),
        likes_post: 0,
        deleted: false,
        author_type: 'organization',
        username: profile.username
      };

      console.log('Post data to insert:', postData);

      const { data, error: insertError } = await supabase
        .from('community_posts')
        .insert([postData])
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        console.error('Error details:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        throw insertError;
      }

      console.log('Post created successfully:', data);

      // Format the new post with proper structure
      const newPost = {
        ...data,
        user_liked: false, // New posts are not liked by default
        tags: postPreview.tags || [] // Add tags if they exist
      };

      console.log('Formatted new post:', newPost);

      setPosts(prev => [newPost, ...prev]);
      handlePostDelete();
      addNotification('Post published successfully!', 'success');

      // Verify the post was actually inserted by fetching it from the database
      console.log('Verifying post insertion...');
      setTimeout(async () => {
        try {
          const { data: verifyData, error: verifyError } = await supabase
            .from('community_posts')
            .select('*')
            .eq('id', data.id)
            .single();

          if (verifyError) {
            console.error('Error verifying post insertion:', verifyError);
          } else {
            console.log('Post verified in database:', verifyData);
          }
        } catch (error) {
          console.error('Error in post verification:', error);
        }
      }, 1000);
    } catch (error) {
      console.error('Error creating post:', error);
      addNotification('Error creating post.', 'error');
    } finally {
      setPosting(false);
    }
  };

  // Update handlePostComment function
  const handlePostComment = async (postId: string) => {
    if (!profile || !commentContent[postId]?.trim()) return;
    setPostingComment(prev => ({ ...prev, [postId]: true }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // First verify the post exists
      const { data: postData, error: postError } = await supabase
        .from('community_posts')
        .select('id')
        .eq('id', postId)
        .single();

      if (postError || !postData) {
        console.error('Post not found:', postError);
        throw new Error('Post not found');
      }

      // Match exact column order from the API request
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          user_id: user.id,
          username: profile.username || '',
          author: profile.full_name || profile.username || '',
          text: commentContent[postId].trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        addNotification('Error posting comment.', 'error');
        return;
      }
      const data = result.comment;
      setComments(prev => ({
        ...prev,
        [postId]: [{ ...data, likes: data.likes ?? 0, user_liked: false }, ...(prev[postId] || [])]
      }));

      setCommentContent(prev => ({ ...prev, [postId]: '' }));
      addNotification('Comment posted successfully!', 'success');
    } catch (error) {
      console.error('Error in handlePostComment:', error);
      addNotification('Error posting comment.', 'error');
    } finally {
      setPostingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Update fetchComments function
  const fetchComments = async (postId: string) => {
    try {
      console.log('Fetching comments for post:', postId);
      const { data, error } = await supabase
        .from('community_comments')
        .select('*')
        .eq('post_id', postId)
        .eq('deleted', false)
        .order(commentSort === 'newest' ? 'created_at' : 'likes', { ascending: false });

      if (error) {
        console.error('Error fetching comments:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Fetched comments:', data);

      // Get the current authenticated user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch comment likes for this post
      const commentIds = (data || []).map(comment => comment.id);
      let commentLikes: any[] = [];
      
      if (commentIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
          .from('community_comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', commentIds);

        if (!likesError && likesData) {
          commentLikes = likesData;
        }
      }

      const processedComments: Comment[] = (data || []).map((comment: Record<string, unknown> & { id: string; likes?: number }) => {
        const commentLikeCount = commentLikes.filter(like => like.comment_id === comment.id).length;
        const userLikedThisComment = commentLikes.some(like =>
          like.comment_id === comment.id && like.user_id === currentUserId
        );
        const likes = commentLikeCount > 0 ? commentLikeCount : (comment.likes ?? 0);
        return {
          ...comment,
          body: (comment.body ?? comment.text) as string,
          likes,
          likes_comment: likes,
          user_liked: userLikedThisComment
        } as Comment;
      });

      setComments(prev => ({
        ...prev,
        [postId]: processedComments
      }));
    } catch (error) {
      console.error('Error in fetchComments:', error);
      addNotification('Error loading comments.', 'error');
    }
  };

  // Update useEffect to fetch comments when posts load
  useEffect(() => {
    if (profile?.user_id && posts.length > 0) {
      posts.forEach(post => {
        console.log('Fetching comments for post:', post.id);
        fetchComments(post.id);
      });
    }
  }, [profile?.user_id, posts, commentSort]);

  // Add function to like/unlike posts (uses community_post_likes table via API)
  const handleLikePost = async (postId: string, currentlyLiked: boolean) => {
    if (!profile) return;

    const delta = currentlyLiked ? -1 : 1;

    // Optimistic update: show new count and liked state immediately
    const newLikedPosts = new Set(userLikedPosts);
    if (currentlyLiked) newLikedPosts.delete(postId);
    else newLikedPosts.add(postId);
    setUserLikedPosts(newLikedPosts);
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
              ...post,
              likes_post: Math.max(0, (post.likes_post || 0) + delta),
              user_liked: !currentlyLiked,
            }
          : post
      )
    );

    try {
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
        addNotification('Error updating post like.', 'error');
        setUserLikedPosts(userLikedPosts);
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? { ...post, likes_post: Math.max(0, (post.likes_post || 0) - delta), user_liked: currentlyLiked }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Error toggling post like:', error);
      addNotification('Error updating post like.', 'error');
      setUserLikedPosts(userLikedPosts);
      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { ...post, likes_post: Math.max(0, (post.likes_post || 0) - delta), user_liked: currentlyLiked }
            : post
        )
      );
    }
  };

  // Update handleLikeComment function
  const handleLikeComment = async (postId: string, commentId: string, currentlyLiked: boolean) => {
    if (!profile) return;
    setLikingComment(prev => ({ ...prev, [commentId]: true }));

    try {
      // Get the current authenticated user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      console.log('Toggling comment like:', { postId, commentId, currentlyLiked, authUserId: user.id });

      const method = currentlyLiked ? 'DELETE' : 'POST';
      const delta = currentlyLiked ? -1 : 1;

      setComments(prev => ({
        ...prev,
        [postId]: prev[postId].map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                likes: Math.max(0, (comment.likes ?? comment.likes_comment ?? 0) + delta),
                likes_comment: Math.max(0, (comment.likes ?? comment.likes_comment ?? 0) + delta),
                user_liked: !currentlyLiked,
              }
            : comment
        )
      }));

      const url =
        method === 'DELETE'
          ? `/api/community/comments/like?comment_id=${encodeURIComponent(commentId)}&user_id=${encodeURIComponent(user.id)}`
          : '/api/community/comments/like';

      const res = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ comment_id: commentId, user_id: user.id }) : undefined,
      });

      if (!res.ok && res.status !== 409) {
        setComments(prev => ({
          ...prev,
          [postId]: prev[postId].map(comment =>
            comment.id === commentId
              ? {
                  ...comment,
                  likes: Math.max(0, (comment.likes ?? 0) - delta),
                  likes_comment: Math.max(0, (comment.likes_comment ?? 0) - delta),
                  user_liked: currentlyLiked,
                }
              : comment
          )
        }));
        addNotification('Error updating comment like.', 'error');
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      addNotification('Error updating comment like.', 'error');
    } finally {
      setLikingComment(prev => ({ ...prev, [commentId]: false }));
    }
  };

  // Add function to delete comments
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!profile) return;
    setDeletingComment(prev => ({ ...prev, [commentId]: true }));

    try {
      // Get the current authenticated user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const { error } = await supabase
        .from('community_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting comment:', error);
        throw error;
      }

      // Remove the comment from the local state
      setComments(prev => ({
        ...prev,
        [postId]: prev[postId].filter(comment => comment.id !== commentId)
      }));

      addNotification('Comment deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting comment:', error);
      addNotification('Error deleting comment.', 'error');
    } finally {
      setDeletingComment(prev => ({ ...prev, [commentId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <Spinner size={48} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 text-slate-700">
        <Building className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Organization Not Found</h1>
        <p className="mt-2 text-slate-500">We couldn't find an organization profile associated with your account.</p>
      </div>
    );
  }
  
  const burgerItems = [
    { label: 'Edit Organization', onClick: () => document.getElementById('edit-profile')?.scrollIntoView({ behavior: 'smooth' }), icon: <Edit className="h-5 w-5 shrink-0" />, color: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Send Notification', onClick: () => setNotificationModalOpen(true), icon: <Bell className="h-5 w-5 shrink-0" />, color: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Promote Event / Message', href: '/business-dashboard/promote?for=organization', icon: <Megaphone className="h-5 w-5 shrink-0" />, color: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'Delete My Account', href: '/settings', icon: <Trash2 className="h-5 w-5 shrink-0" />, color: 'bg-red-50 dark:bg-red-900/30' },
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans pt-16">
        <DashboardBurgerMenu open={burgerMenuOpen} onOpen={() => setBurgerMenuOpen(true)} onClose={() => setBurgerMenuOpen(false)} items={burgerItems} />
        <div className="fixed top-5 right-5 z-50 space-y-3">
            {notifications.map(n => (
                <Notification key={n.id} {...n} onDismiss={() => dismissNotification(n.id)} />
            ))}
        </div>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* --- Header Section --- */}
        <div className="relative mb-10">
            <div className="w-full h-48 md:h-64 bg-slate-200 dark:bg-slate-700 rounded-xl shadow-inner overflow-hidden">
                <img
                    src={bannerPreview || profile.banner_url || 'https://placehold.co/1200x400/e2e8f0/e2e8f0'}
                    className="w-full h-full object-cover"
                    alt="Organization Banner"
                    key={bannerPreview || profile.banner_url}
                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/1200x400/e2e8f0/e2e8f0?text=Banner+Error'; }}
                />
            </div>
            <label htmlFor="banner-upload" className="absolute top-4 right-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-700 dark:text-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>Change Banner</span>
                <input id="banner-upload" type="file" accept="image/*" className="hidden" onChange={e => setBannerFile(e.target.files?.[0] || null)} />
            </label>
            {/* Name and logo under the banner */}
            <div className="flex items-end gap-4 mt-4">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
                    <div className="w-full h-full rounded-lg bg-slate-200 dark:bg-slate-700 shadow-lg border-4 border-white dark:border-slate-800 overflow-hidden">
                        <img
                            src={logoPreview || profile.logo_url || 'https://placehold.co/150/e2e8f0/e2e8f0'}
                            className="w-full h-full object-cover"
                            alt="Organization Logo"
                            key={logoPreview || profile.logo_url}
                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/150/e2e8f0/e2e8f0?text=Logo+Error'; }}
                        />
                    </div>
                    <label htmlFor="logo-upload" className="absolute bottom-1 right-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-700 dark:text-slate-200 p-1.5 rounded-full cursor-pointer hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm">
                        <Edit className="w-4 h-4" />
                        <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                    </label>
                </div>
                <div className="min-w-0 pb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">{profile.full_name}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <Building className="w-4 h-4 shrink-0"/>
                      Organization
                      {profile.username && (
                        <span className="text-slate-600 dark:text-slate-300"> · @{profile.username}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                      <button type="button" onClick={() => loadFollowList('followers')} className="hover:underline font-medium text-slate-600 dark:text-slate-400">
                        Followers: {followerCount}
                      </button>
                      <button type="button" onClick={() => loadFollowList('following')} className="hover:underline font-medium text-slate-600 dark:text-slate-400">
                        Following: {followingCount}
                      </button>
                    </p>
                </div>
            </div>
        </div>

        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {profile.username ? (
            <Link
              href={`/organization/${profile.username}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md inline-flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 shrink-0" />
              View Profile
            </Link>
          ) : (
            <button
              onClick={() => addNotification('Please set a username to view your public profile.', 'info')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md inline-flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 shrink-0" />
              View Profile
            </button>
          )}
          <Link
            href="/community/post"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md inline-flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4 shrink-0" />
            Post to Community
          </Link>
          <Link
            href="/business-dashboard/promote?for=organization"
            className="rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-800 px-4 py-3 text-sm font-semibold text-indigo-700 dark:text-indigo-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md inline-flex items-center justify-center gap-2"
          >
            <Megaphone className="w-4 h-4 shrink-0" />
            Promote Event / Message
          </Link>
          <button
            onClick={() => setNotificationModalOpen(true)}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md inline-flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4 shrink-0" />
            Send Notification to Members
          </button>
        </div>

        {/* --- Main Content Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-8">
             <Card id="edit-profile">
                <form onSubmit={handleSave} className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">Edit Profile</h2>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Organization name</label>
                        <input
                            type="text"
                            value={form.full_name}
                            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                            placeholder="Your organization's display name"
                            className="form-input w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username (handle)</label>
                        <div className="flex gap-2 items-center">
                            <span className="text-slate-500 dark:text-slate-400">@</span>
                            <input
                                type="text"
                                value={form.username}
                                onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') }))}
                                placeholder="username"
                                className="form-input flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5"
                            />
                            {usernameStatus === 'available' && <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">Available</span>}
                            {usernameStatus === 'taken' && <span className="text-xs text-red-600 dark:text-red-400 shrink-0">Taken</span>}
                            {usernameStatus === 'invalid' && (form.username || '').trim().length > 0 && <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">Invalid</span>}
                            {usernameStatus === 'checking' && <span className="text-xs text-slate-400 shrink-0 animate-pulse">...</span>}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Letters, numbers, underscores, periods. 3–30 characters. Your profile: hanar.app/organization/<strong>username</strong></p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mission Statement</label>
                        <textarea value={form.mission} onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} rows={4} className="form-textarea" placeholder="Describe your organization's mission..."/>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                        <AddressAutocomplete
                          value={form.address}
                          onSelect={(result: AddressResult) => setForm(f => ({
                            ...f,
                            address: result.formatted_address,
                            address_city: result.city || '',
                            address_state: result.state || '',
                            address_zip: result.zip || '',
                            address_lat: result.lat ?? null,
                            address_lng: result.lng ?? null,
                          }))}
                          onChange={(value) => setForm(f => ({ ...f, address: value }))}
                          placeholder="Start typing address or city..."
                          mode="full"
                          inputClassName="form-input pl-9"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contact Information</label>
                        <div className="space-y-3">
                          <div className="input-wrapper">
                            <Phone className="input-icon w-4 h-4" />
                            <input 
                              type="tel" 
                              value={form.phone} 
                              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} 
                              className="form-input" 
                              placeholder="Phone number"
                            />
                          </div>
                          <div className="input-wrapper">
                            <Globe className="input-icon w-4 h-4" />
                            <input 
                              type="tel" 
                              value={form.whatsapp} 
                              onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} 
                              className="form-input" 
                              placeholder="WhatsApp number"
                            />
                          </div>
                          <div className="input-wrapper">
                            <Mail className="input-icon w-4 h-4" />
                            <input 
                              type="email" 
                              value={form.email} 
                              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                              className="form-input" 
                              placeholder="Contact email"
                            />
                          </div>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Social Links</label>
                        <div className="space-y-3">
                           <div className="relative">
                              <Instagram className="w-4 h-4 absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                              <input type="text" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} className="form-input pl-9" placeholder="Instagram username"/>
                           </div>
                           <div className="relative">
                              <Facebook className="w-4 h-4 absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                              <input type="text" value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} className="form-input pl-9" placeholder="Facebook profile"/>
                           </div>
                           <div className="relative">
                              <Globe className="w-4 h-4 absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                              <input type="text" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="form-input pl-9" placeholder="yourwebsite.com"/>
                           </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Spoken languages (optional)</label>
                        <p className="text-xs text-slate-500 mb-2">Used for ads and matching. Select languages your organization uses.</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                            {spokenLanguagesWithDialects.map((lang) => {
                                const selected = (form.spoken_languages || []).includes(lang.code);
                                return (
                                    <label
                                        key={lang.code}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                                            selected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => setForm((f) => ({
                                                ...f,
                                                spoken_languages: selected
                                                    ? (f.spoken_languages || []).filter((c) => c !== lang.code)
                                                    : [...(f.spoken_languages || []), lang.code],
                                            }))}
                                            className="sr-only"
                                        />
                                        <span aria-hidden>{lang.flag}</span>
                                        <span>{lang.label}</span>
                                    </label>
                                );
                            })}
                            {(form.spoken_languages || []).filter((c) => !predefinedLanguageCodes.has(c)).map((custom) => (
                                <span
                                    key={custom}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
                                >
                                    <span aria-hidden>🌐</span>
                                    <span>{custom}</span>
                                    <button
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, spoken_languages: (f.spoken_languages || []).filter((c) => c !== custom) }))}
                                        className="ml-1 rounded-full p-0.5 hover:bg-slate-200"
                                        aria-label="Remove"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                                type="text"
                                value={newLanguageInput}
                                onChange={(e) => setNewLanguageInput(e.target.value)}
                                placeholder="Add another language"
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm w-48"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const v = newLanguageInput.trim();
                                        if (v && !(form.spoken_languages || []).includes(v)) {
                                            setForm((f) => ({ ...f, spoken_languages: [...(f.spoken_languages || []), v] }));
                                            setNewLanguageInput('');
                                        }
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const v = newLanguageInput.trim();
                                    if (v && !(form.spoken_languages || []).includes(v)) {
                                        setForm((f) => ({ ...f, spoken_languages: [...(f.spoken_languages || []), v] }));
                                        setNewLanguageInput('');
                                    }
                                }}
                                className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                    
                    <button type="submit" disabled={savingProfile} className="btn-primary w-full">
                        {savingProfile ? <Spinner size={20} /> : <Save className="w-4 h-4" />}
                        <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                    </button>
                </form>
             </Card>
          </div>
          
        </div>

        {/* Send Notification to Members Modal – portal so always in view */}
        {notificationModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => { if (!sendingNotification) { setNotificationModalOpen(false); setNotificationTitle(''); setNotificationBody(''); } }} role="dialog" aria-modal="true" aria-label="Send notification">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-slate-800">Send Notification to Members</h2>
                  <button
                    onClick={() => {
                      if (!sendingNotification) {
                        setNotificationModalOpen(false);
                        setNotificationTitle('');
                        setNotificationBody('');
                      }
                    }}
                    disabled={sendingNotification}
                    className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Send a message to your {followerCount} follower{followerCount !== 1 ? 's' : ''}.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Title</label>
                    <input
                      value={notificationTitle}
                      onChange={(e) => setNotificationTitle(e.target.value)}
                      maxLength={140}
                      disabled={sendingNotification}
                      placeholder="e.g. Upcoming event"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                    />
                    <span className="text-xs text-slate-500">{notificationTitle.length}/140</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Message</label>
                    <textarea
                      value={notificationBody}
                      onChange={(e) => setNotificationBody(e.target.value)}
                      maxLength={1000}
                      rows={4}
                      disabled={sendingNotification}
                      placeholder="Write your message to members..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60 resize-none"
                    />
                    <span className="text-xs text-slate-500">{notificationBody.length}/1000</span>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!sendingNotification) {
                          setNotificationModalOpen(false);
                          setNotificationTitle('');
                          setNotificationBody('');
                        }
                      }}
                      disabled={sendingNotification}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={sendNotificationToMembers}
                      disabled={sendingNotification || !notificationTitle.trim() || !notificationBody.trim()}
                      className="btn-primary flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400"
                    >
                      {sendingNotification ? (
                        <>
                          <Spinner size={18} />
                          Sending…
                        </>
                      ) : (
                        'Send Notification'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Followers / Following list modal – portal so always in view */}
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
                      const isSelf = u.id === profile?.user_id;
                      const label = u.displayName || u.username;
                      return (
                        <li key={u.id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-gray-800 transition">
                          <Link
                            href={u.href}
                            onClick={() => setListModal(null)}
                            className="flex items-center gap-3 min-w-0 flex-1"
                          >
                            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-gray-700 overflow-hidden">
                              {u.profile_pic_url ? (
                                <img src={u.profile_pic_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-slate-400">
                                  {u.type === 'organization' ? (
                                    <Building2 className="h-5 w-5" />
                                  ) : (
                                    <User className="h-5 w-5" />
                                  )}
                                </div>
                              )}
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
      </main>
      
      {/* FIX: Removed invalid 'jsx' and 'global' attributes from the <style> tag.
          This is the standard way to include block CSS in a React component without styled-jsx. */}
      <style>{`
        .form-input {
          display: block;
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          background-color: #f8fafc;
          padding: 0.625rem 0.875rem 0.625rem 2.5rem;
          font-size: 0.875rem;
          color: #0f172a;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .form-input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3);
        }
        .form-input::placeholder {
          color: #94a3b8;
        }
        .input-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }
        .input-wrapper {
          position: relative;
        }
        .form-textarea {
          display: block;
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          background--color: #f8fafc;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: #0f172a;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .form-textarea:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3);
        }
        .btn-primary {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.625rem 1rem;
            border-radius: 0.5rem;
            background-color: #4f46e5;
            color: white;
            font-weight: 600;
            font-size: 0.875rem;
            transition: background-color 0.2s;
            border: 1px solid transparent;
        }
        .btn-primary:hover {
            background-color: #4338ca;
        }
        .btn-primary:disabled {
            background-color: #a5b4fc;
            cursor: not-allowed;
        }
        .btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.625rem 1rem;
            border-radius: 0.5rem;
            background-color: #8b5cf6;
            color: white;
            font-weight: 600;
            font-size: 0.875rem;
            transition: background-color 0.2s;
            border: 1px solid transparent;
        }
        .btn-secondary:hover {
            background-color: #7c3aed;
        }
        .btn-secondary:disabled {
            background-color: #c4b5fd;
            cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
