'use client';

import { useEffect, useState, ChangeEvent, FormEvent, FC } from 'react';
import { UploadCloud, Image as ImageIcon, Instagram, Facebook, Globe, Send, Save, Bell, X, Building, Mail, MapPin, Phone, Tag, Edit, Trash2, Heart, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  identity: string;
  text: string;
  created_at: string;
  parent_id: string | null;
  likes_comment: number;
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

// Add new type for modal state
type ModalState = {
  isOpen: boolean;
  type: 'create-post' | 'delete-confirm' | null;
  postId?: string;
};

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

const Card: FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
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
  const [favorites, setFavorites] = useState<Array<{
    id: string;
    business_name: string | null;
    slug: string | null;
    category: string | null;
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
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [followedOrgsOpen, setFollowedOrgsOpen] = useState(false);

  // Add form state for profile editing
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    mission: '',
    address: '',
    banner_url: '',
    logo_url: '',
    phone: '',
    whatsapp: '',
    instagram: '',
    facebook: '',
    website: '',
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
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
            banner_url: data.banner_url || '',
            logo_url: data.logo_url || '',
            phone: data.contact_info?.phone || '',
            whatsapp: data.contact_info?.whatsapp || '',
            instagram: data.socials?.instagram || '',
            facebook: data.socials?.facebook || '',
            website: data.socials?.website || '',
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
    const loadFollowers = async () => {
      if (!profile?.user_id) return;
      const { count } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', profile.user_id);
      setFollowerCount(count || 0);
    };

    loadFollowers();
  }, [profile?.user_id]);

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
            .select('id, business_name, slug, category, logo_url, address')
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
      } catch (err) {
        console.error('Failed to load favorites/organizations', err);
      } finally {
        setFavoritesLoading(false);
        setFollowedOrgsLoading(false);
      }
    };

    loadFavoritesAndOrgs();
  }, []);

  // Load user liked posts from localStorage
  useEffect(() => {
    if (profile?.user_id) {
      // Load liked posts
      const storedPostLikes = localStorage.getItem(`userLikedPosts_${profile.user_id}`);
      if (storedPostLikes) {
        try {
          const likedPostsArray = JSON.parse(storedPostLikes);
          setUserLikedPosts(new Set(likedPostsArray));
        } catch (error) {
          console.error('Error parsing stored post likes:', error);
        }
      }
    }
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

      // Process posts to include user_liked status from localStorage
      const processedPosts = (data || []).map(post => ({
        ...post,
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

    setSavingProfile(true);

    let logo_url = form.logo_url || '';
    let banner_url = form.banner_url || '';

    const uploadFile = async (file: File, folder: string) => {
      // IMPORTANT: must be ORG UUID (organizations.id), NOT user_id
      const orgId = profile.id;
      if (!orgId) throw new Error('Missing organization id (organizations.id).');

      const safeName = file.name.replace(/\s+/g, '-');
      const filePath = `${orgId}/${folder}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(ORG_STORAGE.bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(ORG_STORAGE.bucket)
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    };

    try {
      if (logoFile) logo_url = await uploadFile(logoFile, ORG_STORAGE.logoFolder);
      if (bannerFile) banner_url = await uploadFile(bannerFile, ORG_STORAGE.bannerFolder);

      const updatedProfile = {
        user_id: profile.user_id,
        full_name: form.full_name,
        username: form.username,
        email: form.email,
        mission: form.mission,
        address: form.address,
        banner_url,
        logo_url,
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
        banner_url: fresh.banner_url || '',
        logo_url: fresh.logo_url || '',
        phone: fresh.contact_info?.phone || '',
        whatsapp: fresh.contact_info?.whatsapp || '',
        instagram: fresh.socials?.instagram || '',
        facebook: fresh.socials?.facebook || '',
        website: fresh.socials?.website || '',
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
        const fileExt = postImage.name.split('.').pop();
        const orgId = profile.id || profile.user_id;
        const fileName = `${orgId}/${ORG_STORAGE.postFolder}/post-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(ORG_STORAGE.bucket)
          .upload(fileName, postImage);

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
      const comment = {
        post_id: postId,
        user_id: user.id,
        username: profile.username || '',
        author: profile.full_name || '',
        identity: 'author',
        text: commentContent[postId].trim(),
        created_at: new Date().toISOString(),
        parent_id: null,
        likes_comment: 0
      };

      console.log('Attempting to create comment with data:', comment);

      const { data, error } = await supabase
        .from('community_comments')
        .insert([comment])
        .select('id,post_id,user_id,username,author,identity,text,created_at,parent_id,likes_comment')
        .single();

      if (error) {
        console.error('Error creating comment:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Successfully created comment:', data);

      setComments(prev => ({
        ...prev,
        [postId]: [data, ...(prev[postId] || [])]
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
        .order(commentSort === 'newest' ? 'created_at' : 'likes_comment', { ascending: commentSort === 'newest' ? false : false });

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

      // Process comments to include like counts and user_liked status
      const processedComments = (data || []).map(comment => {
        const commentLikeCount = commentLikes.filter(like => like.comment_id === comment.id).length;
        const userLikedThisComment = commentLikes.some(like => 
          like.comment_id === comment.id && like.user_id === currentUserId
        );

        return {
          ...comment,
          likes_comment: commentLikeCount,
          user_liked: userLikedThisComment
        };
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

  // Add function to like/unlike posts
  const handleLikePost = async (postId: string, currentlyLiked: boolean) => {
    if (!profile) return;
    
    try {
      if (currentlyLiked) {
        // Unlike - decrement the like count
        const currentPost = posts.find(p => p.id === postId);
        if (currentPost) {
          const newLikeCount = Math.max(0, currentPost.likes_post - 1);
          await supabase
            .from('community_posts')
            .update({ likes_post: newLikeCount })
            .eq('id', postId);
        }

        // Remove from user's liked posts
        const newLikedPosts = new Set(userLikedPosts);
        newLikedPosts.delete(postId);
        setUserLikedPosts(newLikedPosts);
        
        // Save to localStorage
        localStorage.setItem(`userLikedPosts_${profile.user_id}`, JSON.stringify([...newLikedPosts]));

        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, likes_post: Math.max(0, post.likes_post - 1), user_liked: false }
            : post
        ));
      } else {
        // Like - increment the like count
        const currentPost = posts.find(p => p.id === postId);
        if (currentPost) {
          const newLikeCount = currentPost.likes_post + 1;
          await supabase
            .from('community_posts')
            .update({ likes_post: newLikeCount })
            .eq('id', postId);
        }

        // Add to user's liked posts
        const newLikedPosts = new Set(userLikedPosts);
        newLikedPosts.add(postId);
        setUserLikedPosts(newLikedPosts);
        
        // Save to localStorage
        localStorage.setItem(`userLikedPosts_${profile.user_id}`, JSON.stringify([...newLikedPosts]));

        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, likes_post: post.likes_post + 1, user_liked: true }
            : post
        ));
      }
    } catch (error) {
      console.error('Error toggling post like:', error);
      addNotification('Error updating post like.', 'error');
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

      if (currentlyLiked) {
        // Unlike - remove from community_comment_likes table
        console.log('Removing like from comment:', commentId);
        const { error: deleteError } = await supabase
          .from('community_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error removing comment like:', deleteError);
          throw deleteError;
        }

        console.log('Successfully removed comment like');

        setComments(prev => ({
          ...prev,
          [postId]: prev[postId].map(comment => 
            comment.id === commentId 
              ? { ...comment, likes_comment: Math.max(0, comment.likes_comment - 1), user_liked: false }
              : comment
          )
        }));
      } else {
        // Like - add to community_comment_likes table
        const likeData = { 
          comment_id: commentId, 
          user_id: user.id,
          created_at: new Date().toISOString()
        };

        console.log('Adding like to comment:', likeData);
        const { data: insertData, error: insertError } = await supabase
          .from('community_comment_likes')
          .insert([likeData])
          .select()
          .single();

        if (insertError) {
          console.error('Error adding comment like:', insertError);
          console.error('Error details:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
          throw insertError;
        }

        console.log('Successfully added comment like:', insertData);

        setComments(prev => ({
          ...prev,
          [postId]: prev[postId].map(comment => 
            comment.id === commentId 
              ? { ...comment, likes_comment: comment.likes_comment + 1, user_liked: true }
              : comment
          )
        }));
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
  
  return (
    <div className="bg-slate-50 min-h-screen font-sans">
        <div className="fixed top-5 right-5 z-50 space-y-3">
            {notifications.map(n => (
                <Notification key={n.id} {...n} onDismiss={() => dismissNotification(n.id)} />
            ))}
        </div>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* --- Header Section --- */}
        <div className="relative mb-16">
            <div className="w-full h-48 md:h-64 bg-slate-200 rounded-xl shadow-inner overflow-hidden">
                <img
                    src={bannerPreview || profile.banner_url || 'https://placehold.co/1200x400/e2e8f0/e2e8f0'}
                    className="w-full h-full object-cover"
                    alt="Organization Banner"
                    key={bannerPreview || profile.banner_url}
                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/1200x400/e2e8f0/e2e8f0?text=Banner+Error'; }}
                />
            </div>
            <label htmlFor="banner-upload" className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm text-slate-700 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white transition-all shadow-sm flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>Change Banner</span>
                <input id="banner-upload" type="file" accept="image/*" className="hidden" onChange={e => setBannerFile(e.target.files?.[0] || null)} />
            </label>
            <div className="absolute left-6 sm:left-10 -bottom-12 flex items-end gap-4">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32">
                    <div className="w-full h-full rounded-lg bg-slate-200 shadow-lg border-4 border-slate-50 overflow-hidden">
                        <img
                            src={logoPreview || profile.logo_url || 'https://placehold.co/150/e2e8f0/e2e8f0'}
                            className="w-full h-full object-cover"
                            alt="Organization Logo"
                            key={logoPreview || profile.logo_url}
                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/150/e2e8f0/e2e8f0?text=Logo+Error'; }}
                        />
                    </div>
                    <label htmlFor="logo-upload" className="absolute bottom-1 right-1 bg-white/80 backdrop-blur-sm text-slate-700 p-1.5 rounded-full cursor-pointer hover:bg-white transition-all shadow-sm">
                        <Edit className="w-4 h-4" />
                        <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                    </label>
                </div>
                <div>
                    <h1 className="mt-72 text-2xl sm:text-3xl font-bold text-slate-800">{profile.full_name}</h1>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <Building className="w-4 h-4"/>
                      Organization
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Followers: {followerCount}</p>
                </div>
            </div>
        </div>

        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {profile.username ? (
            <Link
              href={`/organization/${profile.username}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              View Profile
            </Link>
          ) : (
            <button
              onClick={() => addNotification('Please set a username to view your public profile.', 'info')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              View Profile
            </button>
          )}
          <Link
            href="/community/post"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Post to Community
          </Link>
          <button
            onClick={() => addNotification('Event promotion coming soon.', 'info')}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Promote Event / Message
          </button>
          <button
            onClick={() => addNotification('Member notifications coming soon.', 'info')}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Send Notification to Members
          </button>
        </div>

        {/* --- Main Content Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-8">
             <Card>
                <form onSubmit={handleSave} className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4">Edit Profile</h2>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mission Statement</label>
                        <textarea value={form.mission} onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} rows={4} className="form-textarea" placeholder="Describe your organization's mission..."/>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                        <div className="relative">
                           <MapPin className="w-4 h-4 absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                           <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="form-input pl-9" placeholder="123 Charity Lane..."/>
                        </div>
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
                    
                    <button type="submit" disabled={savingProfile} className="btn-primary w-full">
                        {savingProfile ? <Spinner size={20} /> : <Save className="w-4 h-4" />}
                        <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                    </button>
                </form>
             </Card>

             <Card>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-slate-800">Announcements</h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setModal({ isOpen: true, type: 'create-post' })}
                      className="btn-secondary"
                    >
                      <Send className="w-4 h-4" />
                      <span>Create Post</span>
                    </button>
                  </div>
                </div>

                {postPreview && (
                  <div className="mb-6 p-4 border border-slate-200 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-lg text-slate-800">{postPreview.title}</h3>
                      <div className="flex gap-2">
                        <button 
                          onClick={handlePublishPost}
                          disabled={posting}
                          className="btn-primary"
                        >
                          {posting ? <Spinner size={20} /> : <Send className="w-4 h-4" />}
                          <span>{posting ? 'Publishing...' : 'Publish'}</span>
                        </button>
                        <button 
                          onClick={handlePostDelete}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {postPreview.image && (
                      <div className="aspect-video bg-slate-200 mb-4 rounded-lg overflow-hidden">
                        <img 
                          src={postPreview.image} 
                          alt="Post preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <p className="text-slate-600 mb-4">{postPreview.body}</p>
                    {postPreview.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {postPreview.tags.map(tag => (
                          <span key={tag} className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Posts List */}
                {postsLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Spinner />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center text-slate-500 py-16">
                    <Send className="w-12 h-12 mx-auto mb-4 text-slate-400"/>
                    <h3 className="text-lg font-semibold">No posts yet.</h3>
                    <p>Click the Create Post button to share your first post.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {posts.map(post => (
                      <Card key={post.id} className="p-0 overflow-hidden">
                        {post.image && (
                          <div className="aspect-video bg-slate-200">
                            <img 
                              src={post.image} 
                              alt={post.title} 
                              className="w-full h-full object-cover" 
                              onError={(e) => { e.currentTarget.src = 'https://placehold.co/800x450/e2e8f0/e2e8f0?text=Image+Error'; }}
                            />
                          </div>
                        )}
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg text-slate-800 hover:text-indigo-600 cursor-pointer transition-colors">
                              {post.title}
                            </h3>
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => handleLikePost(post.id, post.user_liked || false)}
                                className={`flex items-center gap-1 ${
                                  post.user_liked 
                                    ? 'text-red-500' 
                                    : 'text-slate-500 hover:text-red-500'
                                }`}
                              >
                                <Heart className={`w-4 h-4 ${post.user_liked ? 'fill-current' : ''}`} />
                                <span>{post.likes_post || 0} likes</span>
                              </button>
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                disabled={deletingPost}
                                className="text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                {deletingPost ? (
                                  <Spinner className="w-5 h-5" />
                                ) : (
                                  <Trash2 className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-slate-600 mb-4 text-sm">{post.body}</p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {Array.isArray(post.tags) && post.tags.map(tag => (
                              <span key={tag} className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleLikePost(post.id, post.user_liked || false)}
                                className={`flex items-center gap-1 ${
                                  post.user_liked 
                                    ? 'text-red-500' 
                                    : 'text-slate-500 hover:text-red-500'
                                }`}
                              >
                                <Heart className={`w-4 h-4 ${post.user_liked ? 'fill-current' : ''}`} />
                                <span>{post.likes_post || 0} likes</span>
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                          </div>
                          
                          {/* Comments Section */}
                          <div className="mt-6 border-t border-slate-100 pt-4">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="font-semibold text-slate-800">Comments</h4>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setCommentSort('newest')}
                                  className={`text-sm px-3 py-1 rounded-full ${
                                    commentSort === 'newest' 
                                      ? 'bg-indigo-100 text-indigo-700' 
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  Newest
                                </button>
                                <button
                                  onClick={() => setCommentSort('popular')}
                                  className={`text-sm px-3 py-1 rounded-full ${
                                    commentSort === 'popular' 
                                      ? 'bg-indigo-100 text-indigo-700' 
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  Popular
                                </button>
                              </div>
                            </div>

                            {/* Comment Input */}
                            <div className="mb-4">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={commentContent[post.id] || ''}
                                  onChange={e => setCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                                  placeholder="Write a comment..."
                                  className="form-input flex-1"
                                />
                                <button
                                  onClick={() => handlePostComment(post.id)}
                                  disabled={postingComment[post.id] || !commentContent[post.id]?.trim()}
                                  className="btn-primary"
                                >
                                  {postingComment[post.id] ? <Spinner size={20} /> : <Send className="w-4 h-4" />}
                                  <span>Post</span>
                                </button>
                              </div>
                            </div>

                            {/* Comments List */}
                            <div className="space-y-4">
                              {comments[post.id]?.map(comment => (
                                <div key={comment.id} className="flex gap-3">
                                  <div className="flex-1 bg-slate-50 rounded-lg p-3">
                                    <div className="flex justify-between items-start mb-1">
                                      <span className="font-medium text-slate-800">{comment.username}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">
                                          {new Date(comment.created_at).toLocaleDateString()}
                                        </span>
                                        <button
                                          onClick={() => handleDeleteComment(post.id, comment.id)}
                                          disabled={deletingComment[comment.id]}
                                          className="text-red-500 hover:text-red-700 disabled:opacity-50 text-xs font-medium"
                                          title="Delete comment"
                                        >
                                          {deletingComment[comment.id] ? (
                                            <Spinner className="w-3 h-3" />
                                          ) : (
                                            'Delete'
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-slate-600 text-sm mb-2">{comment.text}</p>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleLikeComment(post.id, comment.id, comment.user_liked || false)}
                                        disabled={likingComment[comment.id]}
                                        className={`flex items-center gap-1 text-xs ${
                                          comment.user_liked 
                                            ? 'text-red-500' 
                                            : 'text-slate-500 hover:text-red-500'
                                        }`}
                                      >
                                        <Heart className={`w-4 h-4 ${comment.user_liked ? 'fill-current' : ''}`} />
                                        <span>{comment.likes_comment}</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <button
                  type="button"
                  onClick={() => setFavoritesOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Favorite Businesses</h2>
                    <span className="text-sm text-slate-500">{favorites.length} total</span>
                  </div>
                  <span className="text-sm text-slate-500">{favoritesOpen ? 'Hide' : 'Show'}</span>
                </button>

                {favoritesOpen && (
                  <>
                    {favoritesLoading ? (
                      <div className="mt-4 text-slate-500">Loading favorites...</div>
                    ) : favorites.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                        No favorites yet.
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-3">
                        {favorites.map((biz) => (
                          <button
                            key={biz.id}
                            onClick={() => biz.slug && router.push(`/business/${biz.slug}`)}
                            className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                          >
                            <div className="h-11 w-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                              {biz.logo_url ? (
                                <img
                                  src={biz.logo_url}
                                  alt={biz.business_name || 'Business'}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://placehold.co/44x44/94a3b8/ffffff?text=Logo';
                                    e.currentTarget.onerror = null;
                                  }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                                  Logo
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {biz.business_name || 'Business'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {biz.address?.city || ''}{biz.address?.state ? `, ${biz.address.state}` : ''}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>

              <Card>
                <button
                  type="button"
                  onClick={() => setFollowedOrgsOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-indigo-900">Following Organizations</h2>
                    <span className="text-sm text-indigo-700">{followedOrgs.length} total</span>
                  </div>
                  <span className="text-sm text-indigo-700">{followedOrgsOpen ? 'Hide' : 'Show'}</span>
                </button>

                {followedOrgsOpen && (
                  <>
                    {followedOrgsLoading ? (
                      <div className="mt-4 text-indigo-700">Loading organizations...</div>
                    ) : followedOrgs.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-indigo-200 p-6 text-center text-indigo-700">
                        No organizations followed yet.
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-3">
                        {followedOrgs.map((org) => (
                          <button
                            key={org.user_id}
                            onClick={() => org.username && router.push(`/organization/${org.username}`)}
                            className="group flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                          >
                            <div className="h-11 w-11 rounded-xl overflow-hidden border border-indigo-100 bg-indigo-100">
                              {org.logo_url ? (
                                <img
                                  src={org.logo_url}
                                  alt={org.full_name || 'Organization'}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://placehold.co/44x44/94a3b8/ffffff?text=Org';
                                    e.currentTarget.onerror = null;
                                  }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-indigo-700">
                                  Org
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-indigo-900">
                                {org.full_name || 'Organization'}
                              </p>
                              <p className="text-xs text-indigo-700">
                                {org.username ? `@${org.username}` : ''}
                              </p>
                            </div>
                            <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                              Organization
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>
          </div>
          
          <div className="lg:col-span-2">
            {/* Create Post Modal */}
            {modal.isOpen && modal.type === 'create-post' && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-slate-800">Create a Post</h2>
                      <button 
                        onClick={() => setModal({ isOpen: false, type: null })}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      handlePostPreview();
                      setModal({ isOpen: false, type: null });
                    }} className="space-y-4">
                      <input 
                        type="text" 
                        value={postTitle} 
                        onChange={e => setPostTitle(e.target.value)} 
                        required 
                        className="form-input" 
                        placeholder="Post Title" 
                      />
                      <textarea 
                        value={postBody} 
                        onChange={e => setPostBody(e.target.value)} 
                        required 
                        rows={5} 
                        className="form-textarea" 
                        placeholder="What's on your mind?" 
                      />
                      <div className="relative">
                        <Tag className="w-4 h-4 absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          value={postTags} 
                          onChange={e => setPostTags(e.target.value)} 
                          className="form-input pl-9" 
                          placeholder="Tags (comma-separated)" 
                        />
                      </div>
                      
                      <label htmlFor="post-image-upload" className="w-full text-sm text-center border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors flex flex-col items-center justify-center">
                        {postImagePreview ? (
                          <img src={postImagePreview} alt="Post preview" className="w-full h-32 object-cover rounded-md mb-2"/>
                        ) : (
                          <div className="flex flex-col items-center text-slate-500">
                            <ImageIcon className="w-8 h-8 mb-2" />
                            <span className="font-semibold">Click to upload an image</span>
                            <span className="text-xs">PNG, JPG, GIF up to 10MB</span>
                          </div>
                        )}
                        <input 
                          id="post-image-upload" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={e => setPostImage(e.target.files?.[0] || null)} 
                        />
                      </label>
                      
                      {postImage && (
                        <button 
                          type="button" 
                          onClick={() => { setPostImage(null); setPostImagePreview(null); }} 
                          className="text-xs text-red-500 hover:underline flex items-center gap-1 mx-auto"
                        >
                          <Trash2 className="w-3 h-3"/>
                          Remove image
                        </button>
                      )}
                      
                      <div className="flex gap-3">
                        <button 
                          type="button" 
                          onClick={() => setModal({ isOpen: false, type: null })}
                          className="btn-secondary flex-1"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          className="btn-primary flex-1"
                        >
                          Preview Post
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {modal.isOpen && modal.type === 'delete-confirm' && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Delete Post</h2>
                    <button 
                      onClick={() => setModal({ isOpen: false, type: null })}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <p className="text-slate-600 mb-6">
                    Are you sure you want to delete this post? This action cannot be undone.
                  </p>
                  
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setModal({ isOpen: false, type: null })}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={() => modal.postId && handleDeletePost(modal.postId)}
                      disabled={deletingPost}
                      className="btn-primary flex-1 bg-red-500 hover:bg-red-600"
                    >
                      {deletingPost ? <Spinner size={20} /> : <Trash2 className="w-4 h-4" />}
                      <span>{deletingPost ? 'Deleting...' : 'Delete Post'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
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
