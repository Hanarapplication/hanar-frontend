'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';
import { MarketplaceCategorySelects } from '@/components/MarketplaceCategorySelects';

const MAX_PHOTOS = 5;
type LocationGranularity = 'country' | 'state' | 'city' | 'zip' | 'full';

export default function AdminSeedMarketplacePage() {
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [pickedLocation, setPickedLocation] = useState<AddressResult | null>(null);
  const [locationGranularity, setLocationGranularity] = useState<LocationGranularity>('city');
  const [seedUsers, setSeedUsers] = useState<string[]>([]);
  const [seedUsersLoading, setSeedUsersLoading] = useState(true);
  const [form, setForm] = useState({
    seedUsername: '',
    title: '',
    price: '',
    location: '',
    category: '',
    condition: 'New',
    description: '',
    affiliationLink: '',
    expiresAt: '',
    neverExpires: true,
    photoUrlsText: '',
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const buildLocationPayload = () => {
    const picked = pickedLocation;
    if (!picked) {
      return {
        location: form.location.trim(),
        locationCountry: '',
        locationState: '',
        locationCity: '',
        locationZip: '',
        locationLat: null as number | null,
        locationLng: null as number | null,
      };
    }
    const country = (picked.country || '').trim();
    const state = (picked.state || '').trim();
    const city = (picked.city || '').trim();
    const zip = (picked.zip || '').trim();
    const fullLabel = [city, state, country].filter(Boolean).join(', ') || picked.formatted_address || form.location.trim();

    if (locationGranularity === 'country') {
      return { location: country || fullLabel, locationCountry: country, locationState: '', locationCity: '', locationZip: '', locationLat: null, locationLng: null };
    }
    if (locationGranularity === 'state') {
      return {
        location: [state, country].filter(Boolean).join(', ') || fullLabel,
        locationCountry: country,
        locationState: state,
        locationCity: '',
        locationZip: '',
        locationLat: null,
        locationLng: null,
      };
    }
    if (locationGranularity === 'zip') {
      return {
        location: [zip, city, state, country].filter(Boolean).join(', ') || fullLabel,
        locationCountry: country,
        locationState: state,
        locationCity: city,
        locationZip: zip,
        locationLat: picked.lat ?? null,
        locationLng: picked.lng ?? null,
      };
    }
    if (locationGranularity === 'full') {
      return {
        location: picked.formatted_address || fullLabel,
        locationCountry: country,
        locationState: state,
        locationCity: city,
        locationZip: zip,
        locationLat: picked.lat ?? null,
        locationLng: picked.lng ?? null,
      };
    }
    return {
      location: [city, state, country].filter(Boolean).join(', ') || fullLabel,
      locationCountry: country,
      locationState: state,
      locationCity: city,
      locationZip: '',
      locationLat: picked.lat ?? null,
      locationLng: picked.lng ?? null,
    };
  };

  useEffect(() => {
    (async () => {
      setSeedUsersLoading(true);
      try {
        const res = await fetch('/api/admin/seed-marketplace');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error || 'Failed to load seed users');
          setSeedUsers([]);
          return;
        }
        const users = Array.isArray(data?.seedUsers)
          ? data.seedUsers.map((u: unknown) => String(u)).filter(Boolean)
          : [];
        setSeedUsers(users);
        setForm((prev) => ({
          ...prev,
          seedUsername: prev.seedUsername || users[0] || '',
        }));
      } catch {
        toast.error('Failed to load seed users');
        setSeedUsers([]);
      } finally {
        setSeedUsersLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || seedUsersLoading || !form.seedUsername) return;
    setLoading(true);
    try {
      const linkPhotos = form.photoUrlsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (!form.category?.trim()) {
        toast.error('Please select a category and subcategory');
        return;
      }
      if (linkPhotos.length + uploadedPhotoUrls.length > MAX_PHOTOS) {
        toast.error(`You can add up to ${MAX_PHOTOS} photos total (uploads + links).`);
        return;
      }
      const photos = [...uploadedPhotoUrls, ...linkPhotos];

      const loc = buildLocationPayload();
      const payload = {
        seedUsername: form.seedUsername.trim() || undefined,
        title: form.title.trim(),
        price: Number(form.price),
        location: loc.location,
        locationCountry: loc.locationCountry || undefined,
        locationState: loc.locationState || undefined,
        locationCity: loc.locationCity || undefined,
        locationZip: loc.locationZip || undefined,
        locationLat: loc.locationLat,
        locationLng: loc.locationLng,
        category: form.category.trim(),
        condition: form.condition.trim() || 'New',
        description: form.description.trim(),
        affiliationLink: form.affiliationLink.trim(),
        photos,
        expiresAt: form.neverExpires ? 'never' : (form.expiresAt || null),
      };

      const res = await fetch('/api/admin/seed-marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Failed to seed item');
        return;
      }
      toast.success(data?.message || 'Marketplace seed item created');
      setForm((prev) => ({
        ...prev,
        title: '',
        price: '',
        location: '',
        category: '',
        description: '',
        affiliationLink: '',
        expiresAt: '',
        photoUrlsText: '',
      }));
      setUploadedPhotoUrls([]);
      setPickedLocation(null);
      setLocationGranularity('city');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed item');
    } finally {
      setLoading(false);
    }
  };

  const handleDevicePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = Math.max(0, MAX_PHOTOS - uploadedPhotoUrls.length);
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} uploaded photos reached.`);
      e.target.value = '';
      return;
    }
    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    if (filesToUpload.length < files.length) {
      toast(`Only ${remainingSlots} more photo(s) allowed for uploads.`);
    }
    setUploadingPhotos(true);
    try {
      const nextUrls: string[] = [];
      for (const file of filesToUpload) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/seed-marketplace/upload-photo', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error || `Failed to upload ${file.name}`);
          continue;
        }
        if (data?.publicUrl) nextUrls.push(String(data.publicUrl));
      }
      if (nextUrls.length > 0) {
        setUploadedPhotoUrls((prev) => [...prev, ...nextUrls]);
        toast.success(`${nextUrls.length} photo(s) uploaded`);
      }
      e.target.value = '';
    } catch {
      toast.error('Photo upload failed');
    } finally {
      setUploadingPhotos(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Seed Marketplace Item</h1>
      <p className="text-sm text-slate-600 mb-5">
        Add a marketplace item from admin panel using the same `seed_*` user accounts used by Community seeds.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Seed username</label>
          <select
            name="seedUsername"
            value={form.seedUsername}
            onChange={onChange}
            required
            disabled={seedUsersLoading || seedUsers.length === 0}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {seedUsersLoading ? (
              <option value="">Loading seed users...</option>
            ) : seedUsers.length === 0 ? (
              <option value="">No seed users found</option>
            ) : (
              seedUsers.map((username) => (
                <option key={username} value={username}>
                  {username}
                </option>
              ))
            )}
          </select>
          {!seedUsersLoading && seedUsers.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              No `seed_*` users found. Run Seed Community first.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input name="title" value={form.title} onChange={onChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
            <input name="price" type="number" step="0.01" min="0" value={form.price} onChange={onChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <AddressAutocomplete
              value={form.location}
              onSelect={(result) => {
                const label = [result.city, result.state, result.country].filter(Boolean).join(', ') || result.formatted_address;
                setForm((prev) => ({ ...prev, location: label }));
                setPickedLocation(result);
              }}
              onChange={(value) => {
                setForm((prev) => ({ ...prev, location: value }));
                if (!value.trim()) setPickedLocation(null);
              }}
              placeholder="Start typing country, state, city, or ZIP"
              mode="locality"
              inputClassName="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Live location suggestions. Pick country/state/city/zip to control visibility.</p>
          </div>
          <div>
            <MarketplaceCategorySelects
              value={form.category}
              onChange={(category) => setForm((prev) => ({ ...prev, category }))}
              labelId="admin-seed-category"
              labelClassName="block text-sm font-medium text-slate-700 mb-1"
              selectClassName="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location visibility level</label>
          <select
            value={locationGranularity}
            onChange={(e) => setLocationGranularity(e.target.value as LocationGranularity)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="country">Country (e.g. USA = everywhere in USA)</option>
            <option value="state">State/Province (everywhere in selected state)</option>
            <option value="city">City (everywhere in selected city)</option>
            <option value="zip">ZIP/Postal area</option>
            <option value="full">Exact place/address</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
            <select name="condition" value={form.condition} onChange={onChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="New">New</option>
              <option value="Used">Used</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Affiliation link (optional)</label>
            <input name="affiliationLink" type="url" value={form.affiliationLink} onChange={onChange} placeholder="https://..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
          <textarea name="description" value={form.description} onChange={onChange} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Upload photos from device (optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleDevicePhotoUpload}
              disabled={uploadingPhotos || uploadedPhotoUrls.length >= MAX_PHOTOS}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
            />
            {uploadingPhotos ? <p className="mt-1 text-xs text-slate-500">Uploading photos...</p> : null}
            <p className="mt-1 text-xs text-slate-500">
              Uploaded photos: {uploadedPhotoUrls.length}/{MAX_PHOTOS}. Combined total (uploads + links) max {MAX_PHOTOS}.
            </p>
            {uploadedPhotoUrls.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedPhotoUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="flex items-center gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-700 underline truncate"
                    >
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() => setUploadedPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Or add image links (optional, one per line)</label>
          <textarea
            name="photoUrlsText"
            value={form.photoUrlsText}
            onChange={onChange}
            rows={4}
            placeholder={'https://...\nhttps://...'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
          />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.neverExpires}
              onChange={(e) => setForm((prev) => ({ ...prev, neverExpires: e.target.checked }))}
            />
            Never expires
          </label>
          {!form.neverExpires && (
            <div className="mt-2">
              <label className="block text-sm text-slate-700 mb-1">Expires at</label>
              <input
                name="expiresAt"
                type="datetime-local"
                value={form.expiresAt}
                onChange={onChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || uploadingPhotos || seedUsersLoading || seedUsers.length === 0}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add marketplace seed item'}
        </button>
      </form>
    </div>
  );
}
