'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import imageCompression from 'browser-image-compression';
import { FaEye, FaEdit } from 'react-icons/fa';
import { Bold, Italic, Underline as UnderlineIcon, Image as ImageIcon, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/utils/translations';

export default function CreateCommunityPostPage() {
  const [title, setTitle] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [postAs, setPostAs] = useState('personal');
  const [tags, setTags] = useState('');
  const [preview, setPreview] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [charLimitToast, setCharLimitToast] = useState(false);
  const [emptyFieldsToast, setEmptyFieldsToast] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgUsername, setOrgUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { lang } = useLanguage();
  const router = useRouter();

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
        return;
      }

      if (!user) {
        router.push('/login?redirect=/community/post');
        return;
      }

      setUserId(user.id);

      const [{ data: userData }, { data: bizData }, { data: orgData }] = await Promise.all([
        supabase.from('registeredaccounts').select('username').eq('user_id', user.id).single(),
        supabase.from('businesses').select('business_name').eq('user_id', user.id).single(),
        supabase.from('organizations').select('id,full_name,username').eq('user_id', user.id).single(),
      ]);

      if (userData?.username) setUsername(userData.username);
      if (bizData?.business_name) setBusinessName(bizData.business_name);
      if (orgData?.full_name) setOrgName(orgData.full_name);
      if (orgData?.id) setOrgId(orgData.id);
      if (orgData?.username) setOrgUsername(orgData.username);
    };

    fetchUser();
  }, [router]);

  const handleImageUpload = async (file: File) => {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 800,
      useWebWorker: true,
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
    if (file.size > 4 * 1024 * 1024) return alert(t(lang, 'Image must be less than 4MB'));

    try {
      const url = await handleImageUpload(file);
      setImageUrl(url);
      setImage(file);
    } catch {
      alert(t(lang, 'Image processing failed'));
    }
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

    const res = await fetch('/api/community/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        body: plainText,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        lang,
        image: imageUrl,
        author,
        user_id: userId,
        org_id: payloadOrgId,
        author_type: authorType,
        username: payloadUsername,
      }),
    });

    const result = await res.json();
    if (!res.ok) return alert(result.error || 'Failed to submit post');

    setShowToast(true);
    setTimeout(() => router.push('/community'), 2000);
  };

  const getDirection = () => (lang === 'ar' ? 'rtl' : 'ltr');

  const postAsOptions: { value: string; label: string }[] = [
    username ? { value: 'personal', label: `@${username}` } : null,
    orgName ? { value: 'organization', label: orgName } : null,
    { value: 'anonymous', label: t(lang, 'Anonymous') },
  ].filter((opt): opt is { value: string; label: string } => opt !== null);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{t(lang, 'Create Community Post')}</h1>
            <p className="mt-2 text-sm text-slate-500">{t(lang, 'Share an update, ask a question, or start a conversation.')}</p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {showToast && (
              <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                {t(lang, 'Post submitted. Redirecting...')}
              </div>
            )}
            {emptyFieldsToast && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {t(lang, 'Title and content are required.')}
              </div>
            )}
            {charLimitToast && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {t(lang, 'Post content must be under 300 characters.')}
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
                {preview ? t(lang, 'Edit Post') : t(lang, 'Preview Post')}
              </button>
            </div>

      {/* Continue the form with more t(lang, '...') where needed */}


            {preview && editor ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{title || t(lang, 'Untitled Post')}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t(lang, 'Posted as')}: {postAs === 'anonymous' ? 'Anonymous' : postAs === 'business' ? businessName : postAs === 'organization' ? orgName : username}
                  </p>
                </div>
                {imageUrl && (
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
                  <label className="block text-sm font-medium text-slate-700">{t(lang, 'Title or Question')}</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    required
                    className="form-input"
                    placeholder={t(lang, 'Post Title')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t(lang, 'Content')}</label>
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
                      {editor?.getText().length || 0}/300 {t(lang, 'characters')}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t(lang, 'Tags')}</label>
                  <div className="relative mt-2">
                    <Tag className="input-icon w-4 h-4" />
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="form-input pl-9"
                      placeholder={t(lang, 'Tags (comma-separated)')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t(lang, 'Image (optional, max 4MB)')}</label>
                  <label
                    htmlFor="post-image-upload"
                    className="mt-2 w-full text-sm text-center border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors flex flex-col items-center justify-center"
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="Post preview" className="w-full h-32 object-cover rounded-md mb-2" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-500">
                        <ImageIcon className="w-8 h-8 mb-2" />
                        <span className="font-semibold">{t(lang, 'Click to upload an image')}</span>
                        <span className="text-xs">{t(lang, 'PNG, JPG, GIF up to 10MB')}</span>
                      </div>
                    )}
                    <input
                      id="post-image-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
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

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t(lang, 'Post as')}</label>
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

                <button
                  type="submit"
                  className="btn-primary w-full"
                >
                  {t(lang, 'Post to Community')}
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
