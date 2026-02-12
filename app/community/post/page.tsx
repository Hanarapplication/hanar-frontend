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
import { FaEye, FaEdit } from 'react-icons/fa';
import { Bold, Italic, Underline as UnderlineIcon, Image as ImageIcon, Tag, Video, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/utils/translations';

export default function CreateCommunityPostPage() {
  const [title, setTitle] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [postAs, setPostAs] = useState('personal');
  const [visibility, setVisibility] = useState<'profile' | 'community'>('community');
  const [tags, setTags] = useState('');
  const [preview, setPreview] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [charLimitToast, setCharLimitToast] = useState(false);
  const [emptyFieldsToast, setEmptyFieldsToast] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgUsername, setOrgUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isBusinessAccount, setIsBusinessAccount] = useState(false);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const { effectiveLang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const v = searchParams.get('visibility');
    if (v === 'profile' || v === 'community') setVisibility(v);
  }, [searchParams]);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: '',
    autofocus: true,
    editable: true,
    onUpdate: ({ editor }) => {
      const textLength = editor.getText().trim().length;
      if (textLength > 300) {
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
        router.push('/login?redirect=/community/post');
        setCheckingAccount(false);
        return;
      }

      const { data: businessAccount } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (businessAccount) {
        setIsBusinessAccount(true);
        setCheckingAccount(false);
        return;
      }

      setUserId(user.id);

      const [{ data: userData }, { data: orgData }] = await Promise.all([
        supabase.from('registeredaccounts').select('username').eq('user_id', user.id).single(),
        supabase.from('organizations').select('id,full_name,username').eq('user_id', user.id).single(),
      ]);

      if (userData?.username) setUsername(userData.username);
      if (orgData?.full_name) setOrgName(orgData.full_name);
      if (orgData?.id) setOrgId(orgData.id);
      if (orgData?.username) setOrgUsername(orgData.username);
      setCheckingAccount(false);
    };

    fetchUser();
  }, [router]);

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return alert(t(effectiveLang, 'Image must be less than 4MB'));

    try {
      const url = await handleImageUpload(file);
      setImageUrl(url);
      setImage(file);
      // Clear video if image is selected
      clearVideo();
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

  const handleVideoUpload = async (file: File) => {
    const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
    const filePath = `community-videos/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('community-images').upload(filePath, file);
    if (uploadError) throw new Error('Video upload failed');

    const { data } = supabase.storage.from('community-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError('');

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setVideoError('Please select a video file.');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setVideoError('Video must be less than 50MB.');
      return;
    }

    try {
      // Validate duration (max 11 seconds)
      const duration = await getVideoDuration(file);
      if (duration > 11) {
        setVideoError(`Video is ${duration.toFixed(1)}s — maximum is 11 seconds.`);
        if (videoInputRef.current) videoInputRef.current.value = '';
        return;
      }

      setVideoDuration(Math.round(duration * 10) / 10);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setVideoFile(file);

      // Clear image if video is selected
      setImage(null);
      setImageUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Upload
      setVideoUploading(true);
      const url = await handleVideoUpload(file);
      setVideoUrl(url);
    } catch {
      setVideoError('Failed to process video.');
    } finally {
      setVideoUploading(false);
    }
  };

  const clearVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setVideoError('');
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || !userId) {
      alert('User not authenticated');
      return;
    }

    const plainText = editor.getText().trim();

    if (!title.trim() || !plainText) {
      setEmptyFieldsToast(true);
      setTimeout(() => setEmptyFieldsToast(false), 3000);
      return;
    }

    if (plainText.length > 300) {
      setCharLimitToast(true);
      setTimeout(() => setCharLimitToast(false), 3000);
      return;
    }

    const author =
      postAs === 'anonymous' ? 'Anonymous' :
      postAs === 'organization' ? (orgName || 'Organization') :
      username;

    const authorType = postAs === 'organization' ? 'organization' : null;
    const payloadUsername = postAs === 'organization' ? orgUsername : username;
    const payloadOrgId = postAs === 'organization' ? orgId : null;

    if (videoFile && !videoUrl) {
      alert('Video is still uploading. Please wait.');
      return;
    }

    const visibilityToSend = postAs === 'personal' ? visibility : 'community';

    const res = await fetch('/api/community/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        body: plainText,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        lang: effectiveLang,
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

    setShowToast(true);
    setTimeout(() => router.push('/community'), 2000);
  };

  const getDirection = () => (effectiveLang === 'ar' ? 'rtl' : 'ltr');

  const postAsOptions: { value: string; label: string }[] = [
    username ? { value: 'personal', label: `@${username}` } : null,
    orgName ? { value: 'organization', label: orgName } : null,
    { value: 'anonymous', label: t(effectiveLang, 'Anonymous') },
  ].filter((opt): opt is { value: string; label: string } => opt !== null);

  if (checkingAccount) return null;
  if (isBusinessAccount) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 flex items-start justify-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow">
          <h2 className="text-lg font-semibold text-slate-900">Business accounts can’t post</h2>
          <p className="mt-2 text-sm text-slate-600">
            Community posts are for personal and organization accounts only.
          </p>
          <Link
            href="/community"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to Community
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{t(effectiveLang, 'Create Community Post')}</h1>
            <p className="mt-2 text-sm text-slate-500">{t(effectiveLang, 'Share an update, ask a question, or start a conversation.')}</p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {showToast && (
              <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                {t(effectiveLang, 'Post submitted. Redirecting...')}
              </div>
            )}
            {emptyFieldsToast && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {t(effectiveLang, 'Title and content are required.')}
              </div>
            )}
            {charLimitToast && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {t(effectiveLang, 'Post content must be under 300 characters.')}
              </div>
            )}

            <div className="flex items-center justify-end mb-6">
              <button
                onClick={() => setPreview(!preview)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                  preview ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                )}
              >
                {preview ? <FaEdit /> : <FaEye />}
                {preview ? t(effectiveLang, 'Edit Post') : t(effectiveLang, 'Preview Post')}
              </button>
            </div>

      {/* Continue the form with more t(effectiveLang, '...') where needed */}


            {preview && editor ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{title || t(effectiveLang, 'Untitled Post')}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t(effectiveLang, 'Posted as')}: {postAs === 'anonymous' ? 'Anonymous' : postAs === 'organization' ? orgName : username}
                  </p>
                </div>
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
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t(effectiveLang, 'Title or Question')}</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    required
                    className="form-input"
                    placeholder={t(effectiveLang, 'Post Title')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t(effectiveLang, 'Content')}</label>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2">
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
                      <EditorContent editor={editor} className="tiptap-editor min-h-[120px]" />
                    </div>
                    <div className="mt-2 text-right text-xs text-slate-500">
                      {editor?.getText().length || 0}/300 {t(effectiveLang, 'characters')}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t(effectiveLang, 'Tags')}</label>
                  <div className="relative mt-2">
                    <Tag className="input-icon w-4 h-4" />
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="form-input pl-9"
                      placeholder={t(effectiveLang, 'Tags (comma-separated)')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t(effectiveLang, 'Image (optional, max 4MB)')}</label>
                  <label
                    htmlFor={videoPreviewUrl ? undefined : 'post-image-upload'}
                    className={cn(
                      "mt-2 w-full text-sm text-center border-2 border-dashed rounded-lg p-4 transition-colors flex flex-col items-center justify-center",
                      videoPreviewUrl
                        ? 'border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                        : 'border-slate-300 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50'
                    )}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="Post preview" className="w-full h-32 object-cover rounded-md mb-2" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-500">
                        <ImageIcon className="w-8 h-8 mb-2" />
                        <span className="font-semibold">{t(effectiveLang, 'Click to upload an image')}</span>
                        <span className="text-xs">{t(effectiveLang, 'PNG, JPG, GIF up to 10MB')}</span>
                      </div>
                    )}
                    <input
                      id="post-image-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                      disabled={!!videoPreviewUrl}
                    />
                  </label>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setImage(null);
                        setImageUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1 mx-auto mt-2"
                    >
                      Remove image
                    </button>
                  )}
                </div>

                {/* Video Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    {t(effectiveLang, 'Video (optional, max 11 seconds)')}
                  </label>

                  {videoPreviewUrl ? (
                    <div className="mt-2 relative rounded-xl overflow-hidden border-2 border-indigo-200 bg-black">
                      <video
                        src={videoPreviewUrl}
                        controls
                        className="w-full max-h-56 object-contain"
                      />
                      <button
                        type="button"
                        onClick={clearVideo}
                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        {videoUploading && (
                          <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white animate-pulse">
                            Uploading...
                          </span>
                        )}
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
                  ) : (
                    <label
                      htmlFor="post-video-upload"
                      className={cn(
                        "mt-2 w-full text-sm text-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors flex flex-col items-center justify-center",
                        imageUrl
                          ? 'border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                          : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50'
                      )}
                    >
                      <div className="flex flex-col items-center text-slate-500">
                        <Video className="w-8 h-8 mb-2" />
                        <span className="font-semibold">{t(effectiveLang, 'Click to upload a video')}</span>
                        <span className="text-xs">{t(effectiveLang, 'MP4, WebM, MOV — max 11 seconds, 50MB')}</span>
                      </div>
                      <input
                        id="post-video-upload"
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleVideoChange}
                        disabled={!!imageUrl}
                      />
                    </label>
                  )}

                  {videoError && (
                    <p className="mt-2 text-sm text-red-600">{videoError}</p>
                  )}

                  {!imageUrl && !videoPreviewUrl && (
                    <p className="mt-1.5 text-xs text-slate-400 text-center">
                      You can upload either an image or a video, not both.
                    </p>
                  )}
                </div>

                <div>
                  <div>
                  <label className="block text-sm font-medium text-slate-700">{t(effectiveLang, 'Post as')}</label>
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
                    <label className="block text-sm font-medium text-slate-700">{t(effectiveLang, 'Who can see this?')}</label>
                    <div className="mt-2 flex gap-4">
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
                    <p className="mt-1 text-xs text-slate-500">
                      {visibility === 'profile'
                        ? t(effectiveLang, 'Only visible on your profile to people who follow you.')
                        : t(effectiveLang, 'Visible in the public Community feed and on your profile.')}
                    </p>
                  </div>
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
