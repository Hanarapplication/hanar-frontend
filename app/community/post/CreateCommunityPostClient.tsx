'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { compressImage } from '@/lib/imageCompression';
import CommunityVideoStudio from '@/components/CommunityVideoStudio';
import { getCommunityImagesPublicUrl, uploadToCommunityImagesBucket } from '@/lib/supabaseStorageUpload';
import { FaEye, FaEdit } from 'react-icons/fa';
import { Bold, Image as ImageMediaIcon, Italic, Loader2, Underline as UnderlineIcon, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/utils/translations';
import { supportedLanguages } from '@/utils/languages';

/** Client-side language hint from device locale; server confirms using post text. */
function postLanguageCodeForApi(): string {
  if (typeof navigator === 'undefined') return 'en';
  const raw = (navigator.language?.split(/[-_]/)[0] || 'en').trim().toLowerCase();
  if (!raw || raw === 'auto') return 'en';
  return supportedLanguages.some((l) => l.code === raw && l.code !== 'auto') ? raw : 'en';
}
import toast from 'react-hot-toast';

export type CreateCommunityPostEmbed = 'modal' | 'inline';

export type CreateCommunityPostClientProps = {
  /** Compact embed: modal overlay (legacy) or inline expanding panel on home */
  embed?: false | CreateCommunityPostEmbed;
  onCloseRequest?: () => void;
  /** Called after a successful publish (e.g. refresh home feed) */
  onPublished?: () => void;
};

export default function CreateCommunityPostClient({
  embed = false,
  onCloseRequest,
  onPublished,
}: CreateCommunityPostClientProps = {}) {
  const embedded = embed === 'modal' || embed === 'inline';
  const inline = embed === 'inline';
  /** Tighter layout for home Ask panel and modal embed (not full /community/post page). */
  const compact = embedded;

  const onCloseRequestRef = useRef(onCloseRequest);
  onCloseRequestRef.current = onCloseRequest;

  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [postAs, setPostAs] = useState('personal');
  const [visibility, setVisibility] = useState<'profile' | 'community'>('community');
  const [tags, setTags] = useState('');
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const tagsInlineInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [charLimitToast, setCharLimitToast] = useState(false);
  const [emptyFieldsToast, setEmptyFieldsToast] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgUsername, setOrgUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [businessSlug, setBusinessSlug] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadPercent, setVideoUploadPercent] = useState<number | null>(null);
  /** True while reading local file (length) after pick — before preview or trim studio. */
  const [videoReading, setVideoReading] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [videoStudioFile, setVideoStudioFile] = useState<File | null>(null);

  /** Single picker for image or video (`accept="image/*,video/*"`). */
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const { effectiveLang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (embedded) return;
    const v = searchParams.get('visibility');
    if (v === 'profile' || v === 'community') setVisibility(v);
  }, [searchParams, embedded]);

  useEffect(() => {
    if (tagsExpanded) {
      const id = requestAnimationFrame(() => tagsInlineInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [tagsExpanded]);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: '',
    autofocus: embed !== 'inline',
    editable: true,
    onUpdate: ({ editor }) => {
      const textLength = editor.getText().trim().length;
      if (textLength > 500) {
        setCharLimitToast(true);
        setTimeout(() => setCharLimitToast(false), 3000);
      }
    },
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error('Error fetching user:', error.message);
        setCheckingAccount(false);
        return;
      }

      if (!user) {
        if (embedded) {
          onCloseRequestRef.current?.();
          router.push('/login?redirect=/');
        } else {
          router.push('/login?redirect=/community/post');
        }
        setCheckingAccount(false);
        return;
      }

      setUserId(user.id);

      const [{ data: ownedBusiness }, { data: userData }, { data: orgData }] = await Promise.all([
        supabase.from('businesses').select('id, slug, business_name').eq('owner_id', user.id).maybeSingle(),
        supabase.from('registeredaccounts').select('username, full_name').eq('user_id', user.id).maybeSingle(),
        supabase.from('organizations').select('id,full_name,username').eq('user_id', user.id).maybeSingle(),
      ]);

      if (userData?.username) setUsername(userData.username);
      else setUsername(null);
      if (userData?.full_name) setDisplayName(userData.full_name);
      else setDisplayName(null);
      if (orgData?.full_name) setOrgName(orgData.full_name);
      else setOrgName(null);
      if (orgData?.id) setOrgId(orgData.id);
      else setOrgId(null);
      if (orgData?.username) setOrgUsername(orgData.username);
      else setOrgUsername(null);

      setBusinessSlug(ownedBusiness?.slug ?? null);
      setBusinessName(ownedBusiness?.business_name ?? null);

      const identityOptions: { value: string; label: string }[] = [
        userData?.username
          ? { value: 'personal', label: (userData.full_name?.trim() || userData.username) as string }
          : null,
        orgData?.full_name ? { value: 'organization', label: orgData.full_name } : null,
        ownedBusiness?.slug
          ? { value: 'business', label: ownedBusiness.business_name || ownedBusiness.slug }
          : null,
      ].filter((o): o is { value: string; label: string } => o !== null);

      if (identityOptions.length > 0) {
        setPostAs(identityOptions[0].value);
      }

      setCheckingAccount(false);
    };

    fetchUser();
  }, [router, embedded]);

  const handleImageUpload = async (file: File) => {
    const compressed = await compressImage(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1200,
      initialQuality: 0.82,
    });

    const fileName = `${Date.now()}.${compressed.name.split('.').pop()}`;
    const filePath = `community/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('community-images').upload(filePath, compressed);
    if (uploadError) throw new Error('Image upload failed');

    const { data } = supabase.storage.from('community-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const processImageFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      alert(t(effectiveLang, 'Image must be less than 4MB'));
      return;
    }
    clearVideo();
    try {
      const url = await handleImageUpload(file);
      setImageUrl(url);
      setImage(file);
    } catch {
      alert(t(effectiveLang, 'Image processing failed'));
    }
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video'));
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const handleVideoUpload = async (file: File, onProgress?: (percent: number) => void) => {
    const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
    const filePath = `community-videos/${fileName}`;
    await uploadToCommunityImagesBucket(filePath, file, onProgress);
    return getCommunityImagesPublicUrl(filePath);
  };

  const processVideoFile = async (file: File) => {
    setVideoError('');
    setVideoStudioFile(null);

    const STUDIO_INPUT_MAX = 120 * 1024 * 1024;
    if (file.size > STUDIO_INPUT_MAX) {
      setVideoError(`For in-browser editing, use a video under ${STUDIO_INPUT_MAX / (1024 * 1024)} MB.`);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
      return;
    }

    setVideoReading(true);
    try {
      const duration = await getVideoDuration(file);
      const overDuration = duration > 11;
      const overSize = file.size > 50 * 1024 * 1024;

      if (overDuration || overSize) {
        setImage(null);
        setImageUrl(null);
        setVideoStudioFile(file);
        if (mediaInputRef.current) mediaInputRef.current.value = '';
        setVideoReading(false);
        return;
      }

      setVideoDuration(Math.round(duration * 10) / 10);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setVideoFile(file);

      setImage(null);
      setImageUrl(null);

      setVideoReading(false);
      setVideoUploading(true);
      setVideoUploadPercent(0);
      const url = await handleVideoUpload(file, (p) => setVideoUploadPercent(p));
      setVideoUrl(url);
    } catch {
      setVideoError('Failed to process video.');
    } finally {
      setVideoReading(false);
      setVideoUploading(false);
      setVideoUploadPercent(null);
    }
  };

  const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVideoError('');
    if (file.type.startsWith('image/')) {
      await processImageFile(file);
    } else if (file.type.startsWith('video/')) {
      await processVideoFile(file);
    } else {
      setVideoError('Please choose a photo or video.');
    }
  };

  const clearMedia = () => {
    setImage(null);
    setImageUrl(null);
    clearVideo();
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const clearVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setVideoError('');
    setVideoStudioFile(null);
    setVideoUploadPercent(null);
    setVideoReading(false);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || !userId) {
      alert('User not authenticated');
      return;
    }

    const plainText = editor.getText().trim();

    if (!plainText) {
      setEmptyFieldsToast(true);
      setTimeout(() => setEmptyFieldsToast(false), 3000);
      return;
    }

    if (plainText.length > 500) {
      setCharLimitToast(true);
      setTimeout(() => setCharLimitToast(false), 3000);
      return;
    }

    const author =
      postAs === 'organization'
        ? orgName || 'Organization'
        : postAs === 'business'
          ? businessName || businessSlug || 'Business'
          : displayName || username || 'User';

    const authorType =
      postAs === 'organization' ? 'organization' : postAs === 'business' ? 'business' : null;
    const payloadUsername =
      postAs === 'organization' ? orgUsername : postAs === 'business' ? businessSlug : username;
    const payloadOrgId = postAs === 'organization' ? orgId : null;

    if (postAs === 'business' && !businessSlug) {
      alert('Could not load business profile. Please try again.');
      return;
    }

    if (videoFile && !videoUrl) {
      alert('Video is still uploading. Please wait.');
      return;
    }

    const visibilityToSend = postAs === 'personal' ? visibility : 'community';

    const res = await fetch('/api/community/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: plainText.slice(0, 100),
        body: plainText,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        lang: postLanguageCodeForApi(),
        image: imageUrl,
        video: videoUrl,
        author,
        user_id: userId,
        org_id: payloadOrgId,
        author_type: authorType,
        username: payloadUsername,
        visibility: visibilityToSend,
      }),
    });

    const result = await res.json();
    if (!res.ok) return alert(result.error || 'Failed to submit post');

    if (embedded) {
      toast.success(t(effectiveLang, 'Post submitted. Redirecting...'));
      onPublished?.();
      onCloseRequest?.();
      return;
    }
    setShowToast(true);
    setTimeout(() => router.push('/'), 2000);
  };

  const getDirection = () => (effectiveLang === 'ar' ? 'rtl' : 'ltr');

  const postAsOptions: { value: string; label: string }[] = [
    username ? { value: 'personal', label: displayName || username } : null,
    orgName ? { value: 'organization', label: orgName } : null,
    businessSlug ? { value: 'business', label: businessName || businessSlug } : null,
  ].filter((opt): opt is { value: string; label: string } => opt !== null);

  if (checkingAccount) {
    if (embedded) {
      return (
        <div className="flex justify-center py-10">
          <p className="text-sm text-slate-500">{t(effectiveLang, 'Loading...')}</p>
        </div>
      );
    }
    return null;
  }

  if (!checkingAccount && !userId) {
    return null;
  }

  if (!checkingAccount && userId && postAsOptions.length === 0) {
    const noIdentity = (
      <div className={embedded ? 'px-4 py-8 text-center sm:px-6' : 'min-h-screen bg-slate-50 px-4 py-6 flex items-start justify-center'}>
        <div className={embedded ? '' : 'w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow'}>
          <h2 className="text-lg font-semibold text-slate-900">{t(effectiveLang, 'No profile to post from')}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t(effectiveLang, 'Link a personal profile, organization, or business to create a post.')}
          </p>
          {embedded ? (
            <button
              type="button"
              onClick={() => onCloseRequest?.()}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              {t(effectiveLang, 'Close')}
            </button>
          ) : (
            <Link
              href="/"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              {t(effectiveLang, 'Community')}
            </Link>
          )}
        </div>
      </div>
    );
    return noIdentity;
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      <div
        className={
          inline
            ? 'mx-auto max-w-4xl px-2 py-0 sm:px-3'
            : embedded
              ? 'mx-auto max-w-4xl px-2 py-2 sm:px-4 sm:py-3'
              : 'mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8'
        }
      >
        <div
          className={cn(
            'bg-white',
            inline && 'rounded-none border-0 shadow-none',
            !inline && embedded && 'rounded-2xl border border-slate-200 shadow-lg',
            !embedded && 'rounded-2xl border border-slate-200 shadow-xl'
          )}
        >
          {!inline && (
            <div
              className={cn(
                'border-b border-slate-100',
                embedded ? 'px-3 py-2.5 sm:px-5 sm:py-3' : 'px-4 py-4 sm:px-8 sm:py-6'
              )}
            >
              <h1
                className={cn(
                  'font-semibold text-slate-900',
                  embedded ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                )}
                id={embedded ? 'home-compose-post-title' : undefined}
              >
                {t(effectiveLang, 'Create Community Post')}
              </h1>
              <p className={cn('mt-0.5 text-slate-500', embedded ? 'text-xs' : 'text-sm')}>
                {t(effectiveLang, 'Share an update, ask a question, or start a conversation.')}
              </p>
            </div>
          )}

          <div
            className={
              inline
                ? 'px-2 py-2 sm:px-3 sm:py-2.5'
                : embedded
                  ? 'px-3 py-3 sm:px-5 sm:py-4'
                  : 'px-4 py-5 sm:px-8 sm:py-6'
            }
          >
            {showToast && !embedded && (
              <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                {t(effectiveLang, 'Post submitted. Redirecting...')}
              </div>
            )}
            {emptyFieldsToast && (
              <div
                className={cn(
                  'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700',
                  compact ? 'mb-2' : 'mb-6'
                )}
              >
                {t(effectiveLang, 'Post content is required.')}
              </div>
            )}
            {charLimitToast && (
              <div
                className={cn(
                  'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700',
                  compact ? 'mb-2' : 'mb-6'
                )}
              >
                {t(effectiveLang, 'Post content must be under 500 characters.')}
              </div>
            )}

            <div className={cn('flex items-center justify-end', compact ? 'mb-2' : 'mb-6')}>
              <button
                onClick={() => setPreview(!preview)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full font-semibold transition',
                  compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
                  preview ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                )}
              >
                {preview ? <FaEdit /> : <FaEye />}
                {preview ? t(effectiveLang, 'Edit Post') : t(effectiveLang, 'Preview Post')}
              </button>
            </div>

      {/* Continue the form with more t(effectiveLang, '...') where needed */}


            {preview && editor ? (
              <div className={compact ? 'space-y-2.5' : 'space-y-5'}>
                <p className={cn('text-xs text-slate-500', compact ? 'mt-0.5' : 'mt-1')}>
                  {t(effectiveLang, 'Posted as')}:{' '}
                  {postAs === 'organization' ? orgName : postAs === 'business' ? businessName || businessSlug : username}
                </p>
                {videoPreviewUrl && (
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="max-h-72 w-full rounded-xl object-contain bg-black"
                  />
                )}
                {imageUrl && !videoPreviewUrl && (
                  <img src={imageUrl} alt="Preview" className="max-h-72 w-full rounded-xl object-cover" />
                )}
                <div className="prose prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
                {tags && (
                  <div className="flex flex-wrap gap-2">
                    {tags.split(',').map((tag, i) => (
                      <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={compact ? 'space-y-2.5' : 'space-y-6'}>
                <div>
                  <label
                    className={cn(
                      'block font-medium text-slate-700',
                      compact ? 'text-xs' : 'text-sm'
                    )}
                  >
                    {t(effectiveLang, 'Content')}
                  </label>
                  <div
                    className={cn(
                      'mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900/30',
                      compact ? 'p-2' : 'p-3'
                    )}
                  >
                    <input
                      ref={mediaInputRef}
                      id="post-media-upload"
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleMediaChange}
                      disabled={videoReading || videoUploading || !!videoStudioFile}
                    />
                    <div className={cn('flex items-center gap-1.5', compact ? 'mb-1.5' : 'mb-3')}>
                      <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        className={cn(
                          "rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100",
                          editor?.isActive('bold') && 'bg-slate-100 text-slate-900'
                        )}
                      >
                        <Bold size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        className={cn(
                          "rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100",
                          editor?.isActive('italic') && 'bg-slate-100 text-slate-900'
                        )}
                      >
                        <Italic size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => (editor?.chain() as any).focus().toggleUnderline().run()}
                        className={cn(
                          "rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100",
                          editor?.isActive('underline') && 'bg-slate-100 text-slate-900'
                        )}
                      >
                        <UnderlineIcon size={16} />
                      </button>
                    </div>
                    <div
                      className="form-textarea"
                      style={{ direction: getDirection() }}
                      onClick={() => editor?.chain().focus()}
                    >
                      <EditorContent
                        editor={editor}
                        className={cn('tiptap-editor', compact ? 'min-h-[88px]' : 'min-h-[120px]')}
                      />
                    </div>
                    <div
                      className={cn(
                        'flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700',
                        compact ? 'mt-1.5 pt-1.5' : 'mt-2 pt-2'
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <label
                          htmlFor="post-media-upload"
                          className={cn(
                            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
                            'text-[#45bd62] hover:bg-[#45bd62]/10 dark:text-[#5fd47a] dark:hover:bg-[#45bd62]/15',
                            (videoReading || videoUploading || !!videoStudioFile) &&
                              'pointer-events-none cursor-not-allowed opacity-40'
                          )}
                          title="Photo or video"
                        >
                          <ImageMediaIcon
                            className={cn(compact ? 'h-7 w-7' : 'h-8 w-8')}
                            strokeWidth={1.25}
                            aria-hidden
                          />
                          <span className="sr-only">Add photo or video</span>
                        </label>
                        <button
                          type="button"
                          id="post-tags-toggle"
                          onClick={() => setTagsExpanded((open) => !open)}
                          className={cn(
                            'inline-flex shrink-0 items-center justify-center rounded-full p-2 transition-colors',
                            'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40',
                            tagsExpanded && 'bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/50 dark:ring-indigo-700',
                            tags.trim() !== '' && !tagsExpanded && 'ring-1 ring-indigo-200/70 dark:ring-indigo-700/60'
                          )}
                          title={t(effectiveLang, 'Tags')}
                          aria-expanded={tagsExpanded}
                          aria-controls="post-tags-inline-panel"
                        >
                          <Tag
                            className={cn(compact ? 'h-6 w-6' : 'h-7 w-7')}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          <span className="sr-only">{t(effectiveLang, 'Tags')}</span>
                        </button>
                        {videoReading && (
                          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400" />
                            Reading video…
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                        {editor?.getText().length || 0}/500 {t(effectiveLang, 'characters')}
                      </div>
                    </div>
                    {tagsExpanded && (
                      <div
                        id="post-tags-inline-panel"
                        role="region"
                        aria-labelledby="post-tags-toggle"
                        className={cn(
                          'border-t border-slate-100 dark:border-slate-700',
                          compact ? 'pt-2' : 'pt-2.5'
                        )}
                      >
                        <label htmlFor="post-tags-inline" className="sr-only">
                          {t(effectiveLang, 'Tags (comma-separated)')}
                        </label>
                        <input
                          ref={tagsInlineInputRef}
                          id="post-tags-inline"
                          type="text"
                          value={tags}
                          onChange={(e) => setTags(e.target.value)}
                          className="form-input w-full text-sm"
                          placeholder={t(effectiveLang, 'Tags (comma-separated)')}
                          autoComplete="off"
                        />
                        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                          Separate tags with commas (e.g. <span className="font-mono text-slate-600 dark:text-slate-300">news, question, local</span>).
                        </p>
                      </div>
                    )}
                  </div>

                  {videoStudioFile && (
                    <div className={compact ? 'mt-2' : 'mt-3'}>
                      <CommunityVideoStudio
                        compact={compact}
                        file={videoStudioFile}
                        onCancel={() => {
                          setVideoStudioFile(null);
                          if (mediaInputRef.current) mediaInputRef.current.value = '';
                        }}
                        onDone={async (processed) => {
                          let pendingBlobUrl: string | null = null;
                          try {
                            if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                            pendingBlobUrl = URL.createObjectURL(processed);
                            const dur = await getVideoDuration(processed);
                            setVideoDuration(Math.round(dur * 10) / 10);
                            setVideoPreviewUrl(pendingBlobUrl);
                            pendingBlobUrl = null;
                            setVideoFile(processed);
                            setVideoUrl(null);
                            setImage(null);
                            setImageUrl(null);
                            if (mediaInputRef.current) mediaInputRef.current.value = '';
                            setVideoStudioFile(null);

                            setVideoUploading(true);
                            setVideoUploadPercent(0);
                            const uploadedUrl = await handleVideoUpload(processed, (p) =>
                              setVideoUploadPercent(p)
                            );
                            setVideoUrl(uploadedUrl);
                          } catch {
                            if (pendingBlobUrl) URL.revokeObjectURL(pendingBlobUrl);
                            setVideoError('Upload failed after editing. Try again.');
                          } finally {
                            setVideoUploading(false);
                            setVideoUploadPercent(null);
                          }
                        }}
                      />
                    </div>
                  )}

                  {!videoStudioFile && (
                    <>
                      {imageUrl && !videoPreviewUrl && (
                        <div className={cn('relative', compact ? 'mt-2' : 'mt-3')}>
                          <img
                            src={imageUrl}
                            alt=""
                            className={cn(
                              'w-full rounded-lg border border-slate-200 object-cover dark:border-slate-600',
                              compact ? 'h-28' : 'h-32'
                            )}
                          />
                          {!videoUploading && (
                            <button
                              type="button"
                              onClick={clearMedia}
                              className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/75"
                              aria-label="Remove media"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {videoPreviewUrl && (
                        <div
                          className={cn(
                            'relative min-h-[200px] overflow-hidden rounded-xl border-2 border-indigo-200 bg-black',
                            compact ? 'mt-2' : 'mt-3'
                          )}
                        >
                          <video
                            src={videoPreviewUrl}
                            controls={!videoUploading}
                            className={cn('w-full object-contain', compact ? 'max-h-44' : 'max-h-56')}
                          />
                          <button
                            type="button"
                            onClick={clearVideo}
                            disabled={videoUploading}
                            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80 disabled:pointer-events-none disabled:opacity-40"
                            aria-label="Remove video"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          {videoUploading && (
                            <div
                              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center backdrop-blur-sm"
                              aria-live="polite"
                              aria-busy="true"
                            >
                              <Loader2 className="h-10 w-10 shrink-0 animate-spin text-white" aria-hidden />
                              <p className="text-sm font-semibold text-white">
                                {videoUploadPercent !== null
                                  ? `Uploading video ${videoUploadPercent}%`
                                  : 'Uploading video…'}
                              </p>
                              <div className="h-2 w-full max-w-[240px] overflow-hidden rounded-full bg-white/20">
                                <div
                                  className="h-full rounded-full bg-amber-400 transition-[width] duration-150"
                                  style={{
                                    width: `${videoUploadPercent !== null ? Math.min(100, Math.max(0, videoUploadPercent)) : 8}%`,
                                  }}
                                />
                              </div>
                              <p className="text-xs text-white/75">
                                Your clip is being sent to the server. The preview stays visible underneath.
                              </p>
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-2">
                            {videoUrl && !videoUploading && (
                              <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                                Uploaded
                              </span>
                            )}
                            {videoDuration !== null && (
                              <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
                                {videoDuration}s / 11s
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {videoError && (
                    <p
                      className={cn(
                        'text-sm text-red-600 dark:text-red-400',
                        compact ? 'mt-1.5' : 'mt-2'
                      )}
                    >
                      {videoError}
                    </p>
                  )}
                </div>

                <div>
                  <div>
                  <label
                    className={cn(
                      'block font-medium text-slate-700',
                      compact ? 'text-xs' : 'text-sm'
                    )}
                  >
                    {t(effectiveLang, 'Post as')}
                  </label>
                  <select
                    value={postAs}
                    onChange={(e) => setPostAs(e.target.value)}
                    className="form-input"
                  >
                    {postAsOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {postAs === 'personal' && (
                  <div>
                    <label
                      className={cn(
                        'block font-medium text-slate-700',
                        compact ? 'text-xs' : 'text-sm'
                      )}
                    >
                      {t(effectiveLang, 'Who can see this?')}
                    </label>
                    <div className={cn('flex flex-wrap', compact ? 'mt-1.5 gap-2' : 'mt-2 gap-4')}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value="profile"
                          checked={visibility === 'profile'}
                          onChange={() => setVisibility('profile')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">{t(effectiveLang, 'Profile only (followers)')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value="community"
                          checked={visibility === 'community'}
                          onChange={() => setVisibility('community')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">{t(effectiveLang, 'Community (public)')}</span>
                      </label>
                    </div>
                    <p className={cn('text-xs text-slate-500', compact ? 'mt-0.5' : 'mt-1')}>
                      {visibility === 'profile'
                        ? t(effectiveLang, 'Only visible on your profile to people who follow you.')
                        : t(effectiveLang, 'Visible in the public Community feed and on your profile.')}
                    </p>
                  </div>
                )}

                {postAs === 'business' && (
                  <p className={cn('text-xs text-slate-500', compact ? 'mt-1' : 'mt-2')}>
                    Business posts are public in Community and may appear on the home feed.
                  </p>
                )}
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full"
                >
                  {t(effectiveLang, 'Post to Community')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      <style>{`
          .form-input {
            display: block;
            width: 100%;
            border-radius: 0.5rem;
            border: 1px solid #cbd5e1;
            background-color: #f8fafc;
            padding: 0.625rem 0.875rem;
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
          .form-textarea {
            display: block;
            width: 100%;
            border-radius: 0.5rem;
            border: 1px solid #cbd5e1;
            background-color: #f8fafc;
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
          .tiptap-editor .ProseMirror {
            outline: none;
            min-height: 120px;
            color: #0f172a;
            caret-color: #0f172a;
          }
          .tiptap-editor .ProseMirror p {
            margin: 0;
          }
        `}</style>
    </div>
  );
}
