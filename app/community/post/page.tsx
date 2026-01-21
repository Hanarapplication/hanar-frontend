'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import imageCompression from 'browser-image-compression';
import { FaImage, FaEye, FaEdit } from 'react-icons/fa';
import { Bold, Italic, Underline as UnderlineIcon } from 'lucide-react';
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
        supabase.from('organizations').select('org_name').eq('user_id', user.id).single(),
      ]);

      if (userData?.username) setUsername(userData.username);
      if (bizData?.business_name) setBusinessName(bizData.business_name);
      if (orgData?.org_name) setOrgName(orgData.org_name);
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
      username;

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
    { value: 'anonymous', label: t(lang, 'Anonymous') },
  ].filter((opt): opt is { value: string; label: string } => opt !== null);

  return (
    <div className="max-w-3xl mx-auto p-8 mt-12 bg-white rounded-lg shadow-xl border border-gray-200">
      <h1 className="text-3xl font-semibold mb-8 text-gray-800 text-center">{t(lang, 'Create Community Post')}</h1>

      {showToast && <div className="bg-green-100 text-green-700 px-4 py-3 rounded mb-6">{t(lang, 'Post submitted. Redirecting...')}</div>}
      {emptyFieldsToast && <div className="bg-red-100 text-red-700 px-4 py-3 rounded mb-6">{t(lang, 'Title and content are required.')}</div>}
      {charLimitToast && <div className="bg-red-100 text-red-700 px-4 py-3 rounded mb-6">{t(lang, 'Post content must be under 300 characters.')}</div>}

      <div className="flex justify-end mb-4">
        <button onClick={() => setPreview(!preview)} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition duration-200", preview ? 'bg-gray-200 text-gray-700' : 'bg-indigo-500 text-white')}>{preview ? <FaEdit /> : <FaEye />}{preview ? t(lang, 'Edit Post') : t(lang, 'Preview Post')}</button>
      </div>

      {/* Continue the form with more t(lang, '...') where needed */}


      {preview && editor ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
          {imageUrl && <img src={imageUrl} alt="Preview" className="max-h-64 rounded-md w-full object-cover" />}
          <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
          {tags && <div className="flex flex-wrap gap-2">{tags.split(',').map((tag, i) => <span key={i} className="bg-gray-200 px-2 py-1 rounded-full text-xs">{tag.trim()}</span>)}</div>}
          <p className="text-sm text-gray-500">Posted as: {postAs === 'anonymous' ? 'Anonymous' : postAs === 'business' ? businessName : postAs === 'organization' ? orgName : username}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
          <label className="block text-sm font-medium text-gray-700">
  {t(lang, 'Title or Question')}
</label>            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
          </div>

          <div>
          <label className="block text-sm font-medium text-gray-700">
  {t(lang, 'Content')}
</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className="p-1 hover:bg-gray-100 rounded"><Bold size={16} /></button>
              <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className="p-1 hover:bg-gray-100 rounded"><Italic size={16} /></button>
              <button type="button" onClick={() => (editor?.chain() as any).focus().toggleUnderline().run()} className="p-1 hover:bg-gray-100 rounded"><UnderlineIcon size={16} /></button>
            </div>
            <div className="border rounded-md p-2" style={{ direction: getDirection() }} onClick={() => editor?.chain().focus()}>
              <EditorContent editor={editor} className="min-h-[100px]" />
            </div>
            <div className="text-sm text-gray-500 text-right mt-1">{editor?.getText().length || 0}/300 characters</div>
          </div>

          <div>
          <label className="block text-sm font-medium text-gray-700">
  {t(lang, 'Tags')}
</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Image (optional, max 4MB)</label>
            <div className="flex items-center mt-1">
            <button
  type="button"
  className="px-4 py-2 border rounded-md"
  onClick={() => fileInputRef.current?.click()}
>
  <FaImage className="mr-2 inline" />
  {image ? t(lang, 'Change Image') : t(lang, 'Upload Image')}
</button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              {image && <span className="ml-3 text-sm text-gray-500">{image.name}</span>}
            </div>
          </div>

          <div>
          <label className="block text-sm font-medium text-gray-700">
  {t(lang, 'Post as')}
</label>
            <select value={postAs} onChange={(e) => setPostAs(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
              {postAsOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition">
  {t(lang, 'Post to Community')}
</button>
        </form>
      )}
    </div>
  );
}
