'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Check, CheckCheck, ExternalLink, Eye, Image as ImageIcon, Send } from 'lucide-react';

type MessageRow = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  created_at: string;
  read_at?: string | null;
  recipient_entity_type?: 'user' | 'business' | 'organization' | null;
  recipient_entity_id?: string | null;
  recipient_entity_label?: string | null;
  /** Persisted display name for the sender (works when cross-table profile queries are RLS-limited). */
  sender_label?: string | null;
};

type ConversationPreview = {
  peerId: string;
  label: string;
  latestMessage: MessageRow;
  unreadCount: number;
};

type RecipientIntent =
  | { userId: string; label: string; entityType: 'user' | 'business' | 'organization'; entityId: string | null }
  | null;

type ItemPreviewContext = {
  url: string;
  title: string;
  imageUrl: string | null;
  price?: string | null;
  description?: string | null;
};

const PAGE_SIZE = 200;
const THREAD_PAGE_SIZE = 10;
const ITEM_REF_PREFIX = '[ITEM_REF]';

const shortUser = (userId: string) => `User ${userId.slice(0, 6)}`;

function stripAtHandle(raw: string | null | undefined): string {
  return String(raw || '').trim().replace(/^@+/, '');
}

/** Display name from registered account row (full_name, else first + last). */
function registeredAccountDisplayName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const full = String(row.full_name || '').trim();
  if (full) return full;
  const first = String(row.first_name || '').trim();
  const last = String(row.last_name || '').trim();
  return `${first} ${last}`.trim();
}

/** `User ab12cd` fallback from {@link shortUser} — not a real display name. */
function isShortUserPlaceholderLabel(s: string): boolean {
  return /^User\s+[0-9a-f-]{4,12}$/i.test(s.trim());
}

/** Prefer a real display name over a bare handle / placeholder when merging hydrates. */
function preferRicherDisplayName(prev: string | undefined, incoming: string): string {
  const p = (prev || '').trim();
  const n = (incoming || '').trim();
  if (!p) return n;
  if (!n) return p;
  if (p === n) return n;
  if (isShortUserPlaceholderLabel(p) && !isShortUserPlaceholderLabel(n)) return n;
  if (isShortUserPlaceholderLabel(n) && !isShortUserPlaceholderLabel(p)) return p;
  const pSpace = /\s/.test(p);
  const nSpace = /\s/.test(n);
  if (pSpace && !nSpace) return p;
  if (nSpace && !pSpace) return n;
  return n;
}

const DM_PEER_LABEL_CACHE = 'hanar.dm.peerLabels';

function readDmPeerLabelCache(viewerId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(`${DM_PEER_LABEL_CACHE}.${viewerId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeDmPeerLabelCache(viewerId: string, map: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${DM_PEER_LABEL_CACHE}.${viewerId}`, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'inbox' | 'chat'>('inbox');
  const [draft, setDraft] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [selectedAttachmentPreviewUrl, setSelectedAttachmentPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerLabels, setPeerLabels] = useState<Record<string, string>>({});
  const [peerAvatarUrls, setPeerAvatarUrls] = useState<Record<string, string>>({});
  const [peerProfileLinks, setPeerProfileLinks] = useState<Record<string, string>>({});
  const [openMenuPeerId, setOpenMenuPeerId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [actionPeerId, setActionPeerId] = useState<string | null>(null);
  const [deleteConfirmPeerId, setDeleteConfirmPeerId] = useState<string | null>(null);
  const [blockOptionsPeerId, setBlockOptionsPeerId] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxImageAlt, setLightboxImageAlt] = useState<string>('Image');
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [itemPreviewPopup, setItemPreviewPopup] = useState<ItemPreviewContext | null>(null);
  const [itemPreviewPopupVisible, setItemPreviewPopupVisible] = useState(false);
  const [itemPreviewActionContext, setItemPreviewActionContext] = useState<ItemPreviewContext | null>(null);
  const [itemPreviewActionVisible, setItemPreviewActionVisible] = useState(false);
  const [intent, setIntent] = useState<RecipientIntent>(null);
  const intentRef = useRef<RecipientIntent>(null);
  intentRef.current = intent;
  const [pendingItemPreview, setPendingItemPreview] = useState<ItemPreviewContext | null>(null);
  const [visibleThreadCount, setVisibleThreadCount] = useState(THREAD_PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<MessageRow[]>([]);
  messagesRef.current = messages;
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousSelectedPeerRef = useRef<string | null>(null);
  const previousActiveMessagesCountRef = useRef(0);
  const lightboxCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemPreviewCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemPreviewActionCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollThreadToBottom = useCallback(() => {
    const node = threadScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, []);

  const scheduleScrollThreadToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollThreadToBottom();
      });
    });
  }, [scrollThreadToBottom]);

  useEffect(() => {
    if (!selectedAttachment || !String(selectedAttachment.type || '').startsWith('image/')) {
      setSelectedAttachmentPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedAttachment);
    setSelectedAttachmentPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAttachment]);

  const loadMessages = useCallback(async (activeUserId: string): Promise<MessageRow[]> => {
    const baseSelect =
      'id, sender_user_id, recipient_user_id, body, attachment_url, attachment_name, attachment_mime, attachment_size, created_at, read_at, recipient_entity_type, recipient_entity_id, recipient_entity_label';

    const fetchDm = async (select: string) =>
      supabase
        .from('direct_messages')
        .select(select)
        .or(`sender_user_id.eq.${activeUserId},recipient_user_id.eq.${activeUserId}`)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

    const [firstMsgRes, clearsRes] = await Promise.all([
      fetchDm(`${baseSelect}, sender_label`),
      supabase
        .from('message_conversation_clears')
        .select('peer_id, cleared_at')
        .eq('user_id', activeUserId),
    ]);

    let messagesRes = firstMsgRes;
    if (messagesRes.error) {
      const hint = `${messagesRes.error.message || ''} ${(messagesRes.error as { details?: string; hint?: string }).details || ''} ${(messagesRes.error as { hint?: string }).hint || ''}`.toLowerCase();
      const looksLikeMissingSenderLabel =
        hint.includes('sender_label') ||
        hint.includes('schema cache') ||
        (hint.includes('column') && hint.includes('does not exist'));
      if (looksLikeMissingSenderLabel) {
        const fallback = await fetchDm(baseSelect);
        if (!fallback.error) {
          messagesRes = fallback;
        }
      }
    }

    const { data, error: fetchError } = messagesRes;
    const { data: clearRows, error: clearError } = clearsRes;

    const clearMap = new Map<string, number>();
    if (!clearError) {
      for (const row of (clearRows || []) as Array<{ peer_id: string; cleared_at: string }>) {
        const ts = new Date(row.cleared_at).getTime();
        if (!Number.isNaN(ts)) clearMap.set(String(row.peer_id), ts);
      }
    }

    const msgRows = Array.isArray(data) ? (data as unknown as MessageRow[]) : [];
    const filtered = msgRows.filter((row) => {
      const peerId =
        row.sender_user_id === activeUserId ? row.recipient_user_id : row.sender_user_id;
      const clearedAtTs = clearMap.get(String(peerId));
      if (!clearedAtTs) return true;
      const messageTs = new Date(row.created_at).getTime();
      if (Number.isNaN(messageTs)) return true;
      return messageTs > clearedAtTs;
    });

    if (fetchError) {
      setMessages([]);
      setError(fetchError.message || 'Failed to load messages');
      return [];
    }

    setMessages(filtered);
    setError(null);
    return filtered;
  }, []);

  const resolveIntentFromQuery = useCallback(async (): Promise<RecipientIntent> => {
    const targetType = (searchParams.get('targetType') || '').toLowerCase();
    const targetId = searchParams.get('targetId') || '';
    if (!targetType || !targetId) return null;

    if (targetType === 'user') {
      const { data: reg } = await supabase
        .from('registeredaccounts')
        .select('full_name, first_name, last_name, username')
        .eq('user_id', targetId)
        .maybeSingle();
      const display = reg ? registeredAccountDisplayName(reg) : '';
      const handle = reg?.username ? stripAtHandle(reg.username) : '';
      const label = display || handle || shortUser(targetId);
      return { userId: targetId, label, entityType: 'user', entityId: targetId };
    }

    if (targetType === 'business') {
      const { data } = await supabase
        .from('businesses')
        .select('id, owner_id, business_name')
        .eq('id', targetId)
        .maybeSingle();
      if (!data?.owner_id) return null;
      return {
        userId: String(data.owner_id),
        label: data.business_name || 'Business',
        entityType: 'business',
        entityId: data.id,
      };
    }

    if (targetType === 'organization') {
      const { data } = await supabase
        .from('organizations')
        .select('id, user_id, full_name, username')
        .eq('id', targetId)
        .maybeSingle();
      if (!data?.user_id) return null;
      return {
        userId: String(data.user_id),
        label: data.full_name || data.username || 'Organization',
        entityType: 'organization',
        entityId: data.id,
      };
    }

    return null;
  }, [searchParams]);

  const resolveItemPreviewFromQuery = useCallback((): ItemPreviewContext | null => {
    const itemUrl = (searchParams.get('itemUrl') || '').trim();
    if (!itemUrl) return null;
    const itemTitle = (searchParams.get('itemTitle') || 'Listing').trim();
    const itemImage = (searchParams.get('itemImage') || '').trim();
    const itemPrice = (searchParams.get('itemPrice') || '').trim();
    const itemDescription = (searchParams.get('itemDescription') || '').trim();
    return {
      url: itemUrl,
      title: itemTitle || 'Listing',
      imageUrl: itemImage || null,
      price: itemPrice || null,
      description: itemDescription || null,
    };
  }, [searchParams]);

  const parseItemReference = useCallback((text: string) => {
    if (!text.startsWith(ITEM_REF_PREFIX)) return null;
    const bodyWithoutPrefix = text.slice(ITEM_REF_PREFIX.length);
    const firstLineBreak = bodyWithoutPrefix.indexOf('\n');
    const jsonText =
      firstLineBreak === -1 ? bodyWithoutPrefix.trim() : bodyWithoutPrefix.slice(0, firstLineBreak).trim();
    if (!jsonText) return null;
    try {
      const parsed = JSON.parse(jsonText) as {
        url?: string;
        title?: string;
        imageUrl?: string | null;
        price?: string | null;
        description?: string | null;
      };
      const url = String(parsed.url || '').trim();
      if (!url) return null;
      const title = String(parsed.title || 'Listing').trim() || 'Listing';
      const imageUrl = parsed.imageUrl ? String(parsed.imageUrl).trim() : null;
      const price = parsed.price ? String(parsed.price).trim() : null;
      const description = parsed.description ? String(parsed.description).trim() : null;
      const messageText =
        firstLineBreak === -1 ? '' : bodyWithoutPrefix.slice(firstLineBreak + 1).trimStart();
      return {
        reference: {
          url,
          title,
          imageUrl: imageUrl || null,
          price: price || null,
          description: description || null,
        },
        messageText,
      };
    } catch {
      return null;
    }
  }, []);

  const encodeBodyWithItemReference = useCallback((context: ItemPreviewContext, messageText: string) => {
    const metadata = JSON.stringify({
      url: context.url,
      title: context.title,
      imageUrl: context.imageUrl || null,
      price: context.price || null,
      description: context.description || null,
    });
    const normalizedMessage = messageText.trim();
    return `${ITEM_REF_PREFIX}${metadata}${normalizedMessage ? `\n${normalizedMessage}` : ''}`;
  }, []);

  const toPublicStorageUrl = useCallback((bucket: string, path: string) => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!base) return path;
    return `${base}/storage/v1/object/public/${bucket}/${path}`;
  }, []);

  const normalizeAvatarUrl = useCallback(
    (value: string | null | undefined, buckets: string[] = []) => {
      if (!value) return '';
      const trimmed = String(value).trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
      if (buckets.length === 0) return trimmed;
      return toPublicStorageUrl(buckets[0], trimmed);
    },
    [toPublicStorageUrl]
  );

  /** Only changes when the set of DM peers changes — avoids re-hydrating on read receipts / body edits. */
  const peerIdsHydrationKey = useMemo(() => {
    if (!userId) return '';
    const peers = new Set<string>();
    for (const m of messages) {
      const peerId = m.sender_user_id === userId ? m.recipient_user_id : m.sender_user_id;
      if (peerId) peers.add(peerId);
    }
    if (intent?.userId) peers.add(intent.userId);
    return Array.from(peers).sort().join('|');
  }, [userId, messages, intent?.userId]);

  const hydratePeerLabels = useCallback(
    async (activeUserId: string, rows: MessageRow[], extraPeerIds: string[] = []) => {
      const idSet = new Set<string>();
      for (const m of rows) {
        const peerId = m.sender_user_id === activeUserId ? m.recipient_user_id : m.sender_user_id;
        if (peerId) idSet.add(peerId);
      }
      for (const x of extraPeerIds) {
        if (x) idSet.add(x);
      }
      const ids = Array.from(idSet);

      // Do not clear labels when there are no peers yet. After a full refresh, `userId` is set
      // before `messages` is populated; an effect can run with `[]` and would wipe sessionStorage
      // merges and any in-flight hydrate — leaving only handles until the next navigation.
      if (ids.length === 0) {
        return;
      }

      const [profilesRes, regRes, orgRes, bizRes] = await Promise.all([
        supabase.from('profiles').select('id, username, profile_pic_url').in('id', ids),
        supabase
          .from('registeredaccounts')
          .select('user_id, username, full_name, first_name, last_name')
          .in('user_id', ids),
        supabase.from('organizations').select('user_id, full_name, username, logo_url').in('user_id', ids),
        supabase
          .from('businesses')
          .select('owner_id, business_name, logo_url, slug, created_at')
          .in('owner_id', ids)
          .order('created_at', { ascending: false }),
      ]);

      const labelById: Record<string, string> = {};
      const avatarById: Record<string, string> = {};
      const profileLinkById: Record<string, string> = {};

      const bizByOwner = new Map<
        string,
        { business_name?: string | null; logo_url?: string | null; slug?: string | null }
      >();
      for (const row of (bizRes.data || []) as Array<{
        owner_id: string;
        business_name?: string | null;
        logo_url?: string | null;
        slug?: string | null;
      }>) {
        const oid = String(row.owner_id);
        if (!bizByOwner.has(oid)) bizByOwner.set(oid, row);
      }

      const orgByUserId = new Map<
        string,
        { full_name?: string | null; username?: string | null; logo_url?: string | null }
      >();
      for (const row of (orgRes.data || []) as Array<{
        user_id: string;
        full_name?: string | null;
        username?: string | null;
        logo_url?: string | null;
      }>) {
        orgByUserId.set(String(row.user_id), row);
      }

      const regByUserId = new Map<
        string,
        { username?: string | null; full_name?: string | null; first_name?: string | null; last_name?: string | null }
      >();
      for (const row of (regRes.data || []) as Array<{
        user_id: string;
        username?: string | null;
        full_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }>) {
        regByUserId.set(String(row.user_id), row);
      }

      const profileById = new Map<string, { username?: string | null; profile_pic_url?: string | null }>();
      for (const row of (profilesRes.data || []) as Array<{
        id: string;
        username?: string | null;
        profile_pic_url?: string | null;
      }>) {
        profileById.set(String(row.id), row);
      }

      /** From DM rows the viewer can always read (participant); not blocked by other users' RLS. */
      const labelFromDmRows: Record<string, string> = {};
      for (const m of rows) {
        if (m.sender_user_id === activeUserId) continue;
        const sl = String(m.sender_label || '').trim();
        if (!sl) continue;
        labelFromDmRows[m.sender_user_id] = preferRicherDisplayName(labelFromDmRows[m.sender_user_id], sl);
      }

      for (const id of ids) {
        const biz = bizByOwner.get(id);
        const bizName = String(biz?.business_name || '').trim();
        if (bizName) labelById[id] = bizName;
        else {
          const org = orgByUserId.get(id);
          const orgLabel =
            String(org?.full_name || '').trim() || (org?.username ? stripAtHandle(org.username) : '');
          if (orgLabel) labelById[id] = orgLabel;
          else {
            const reg = regByUserId.get(id);
            const person = reg ? registeredAccountDisplayName(reg) : '';
            const regHandle = reg?.username ? stripAtHandle(reg.username) : '';
            const prof = profileById.get(id);
            const profHandle = prof?.username ? stripAtHandle(prof.username) : '';
            labelById[id] = person || regHandle || profHandle || shortUser(id);
          }
        }
      }

      for (const id of ids) {
        const hint = labelFromDmRows[id];
        if (hint) labelById[id] = preferRicherDisplayName(labelById[id], hint);
      }

      for (const row of (profilesRes.data || []) as Array<{ id: string; username?: string | null; profile_pic_url?: string | null }>) {
        const avatar = normalizeAvatarUrl(row.profile_pic_url, ['avatars']);
        if (avatar) avatarById[row.id] = avatar;
        const handle = row.username ? stripAtHandle(row.username) : '';
        if (handle) profileLinkById[row.id] = `/profile/${handle}`;
      }
      for (const row of (regRes.data || []) as Array<{ user_id: string; username?: string | null }>) {
        const handle = row.username ? stripAtHandle(row.username) : '';
        if (handle && !profileLinkById[row.user_id]) profileLinkById[row.user_id] = `/profile/${handle}`;
      }
      for (const row of (orgRes.data || []) as Array<{ user_id: string; username?: string | null; logo_url?: string | null }>) {
        const logo = normalizeAvatarUrl(row.logo_url, ['organization-uploads']);
        if (logo) avatarById[row.user_id] = logo;
        const handle = row.username ? stripAtHandle(row.username) : '';
        if (handle) profileLinkById[row.user_id] = `/organization/${handle}`;
      }
      for (const [oid, row] of bizByOwner) {
        if (!avatarById[oid]) {
          const logo = normalizeAvatarUrl(row.logo_url, ['business-uploads']);
          if (logo) avatarById[oid] = logo;
        }
        if (row.slug && !profileLinkById[oid]) profileLinkById[oid] = `/business/${row.slug}`;
      }

      setPeerLabels((prev) => {
        const cached = readDmPeerLabelCache(activeUserId);
        const mergedForStorage = { ...cached };
        const next: Record<string, string> = {};
        for (const id of ids) {
          const computed = labelById[id] ?? shortUser(id);
          const best = preferRicherDisplayName(
            preferRicherDisplayName(prev[id], cached[id]),
            computed
          );
          next[id] = best;
          mergedForStorage[id] = preferRicherDisplayName(cached[id], best);
        }
        writeDmPeerLabelCache(activeUserId, mergedForStorage);
        return next;
      });
      setPeerAvatarUrls(avatarById);
      setPeerProfileLinks(profileLinkById);
    },
    [normalizeAvatarUrl]
  );

  /** Hydrate with the rows just returned from Supabase — avoids stale `messages` / `messagesRef` before React commits. */
  const runMessagesLoaded = useCallback(
    (activeUserId: string, rows: MessageRow[]) => {
      const extra = intentRef.current?.userId ? [intentRef.current.userId] : [];
      void hydratePeerLabels(activeUserId, rows, extra);
    },
    [hydratePeerLabels]
  );

  const markConversationAsRead = useCallback(async (activeUserId: string, peerId: string) => {
    const nowIso = new Date().toISOString();
    const { data, error: markError } = await supabase
      .from('direct_messages')
      .update({ read_at: nowIso })
      .eq('recipient_user_id', activeUserId)
      .eq('sender_user_id', peerId)
      .is('read_at', null)
      .select('id');
    if (markError) return;
    const updatedIds = new Set(((data || []) as Array<{ id: string }>).map((row) => row.id));
    if (updatedIds.size > 0) {
      setMessages((prev) =>
        prev.map((msg) =>
          updatedIds.has(msg.id)
            ? { ...msg, read_at: nowIso }
            : msg
        )
      );
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('messages:updated'));
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      setUserId(user.id);
      const resolvedIntent = await resolveIntentFromQuery();
      const resolvedItemPreview = resolveItemPreviewFromQuery();
      setIntent(resolvedIntent);
      intentRef.current = resolvedIntent;
      setPendingItemPreview(resolvedItemPreview);
      const rows = await loadMessages(user.id);
      runMessagesLoaded(user.id, rows);
      setLoading(false);
    };
    load();
  }, [router, loadMessages, resolveIntentFromQuery, resolveItemPreviewFromQuery, runMessagesLoaded]);

  useEffect(() => {
    if (!userId) return;
    const cached = readDmPeerLabelCache(userId);
    const keys = Object.keys(cached);
    if (keys.length === 0) return;
    setPeerLabels((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        next[k] = preferRicherDisplayName(prev[k], cached[k]);
      }
      return next;
    });
  }, [userId]);

  /* eslint-disable react-hooks/exhaustive-deps -- `messages` intentionally omitted (peer set = `peerIdsHydrationKey`; `runMessagesLoaded` passes fresh rows after each fetch). */
  useEffect(() => {
    if (!userId) return;
    const extra = intent?.userId ? [intent.userId] : [];
    void hydratePeerLabels(userId, messagesRef.current, extra);
  }, [userId, peerIdsHydrationKey, intent?.userId, hydratePeerLabels]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const conversations = useMemo<ConversationPreview[]>(() => {
    if (!userId) return [];
    const map = new Map<string, ConversationPreview>();
    for (const msg of messages) {
      const peerId = msg.sender_user_id === userId ? msg.recipient_user_id : msg.sender_user_id;
      if (!peerId) continue;
      const existing = map.get(peerId);
      const unreadIncrement = msg.recipient_user_id === userId && !msg.read_at ? 1 : 0;
      const inferred =
        peerLabels[peerId] ||
        (msg.sender_user_id === userId && msg.recipient_entity_label) ||
        shortUser(peerId);
      if (!existing) {
        map.set(peerId, {
          peerId,
          label: inferred,
          latestMessage: msg,
          unreadCount: unreadIncrement,
        });
      } else {
        existing.unreadCount += unreadIncrement;
      }
    }

    if (intent && !map.has(intent.userId)) {
      map.set(intent.userId, {
        peerId: intent.userId,
        label: intent.label,
        latestMessage: {
          id: `intent-${intent.userId}`,
          sender_user_id: userId,
          recipient_user_id: intent.userId,
          body: '',
          created_at: new Date(0).toISOString(),
        },
        unreadCount: 0,
      });
    }

    for (const conv of map.values()) {
      const resolved = peerLabels[conv.peerId];
      if (resolved) conv.label = resolved;
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.latestMessage.created_at).getTime() - new Date(a.latestMessage.created_at).getTime()
    );
  }, [intent, messages, peerLabels, userId]);

  const activeMenuConversation = useMemo(
    () => conversations.find((conversation) => conversation.peerId === openMenuPeerId) || null,
    [conversations, openMenuPeerId]
  );
  const deleteConfirmConversation = useMemo(
    () => conversations.find((conversation) => conversation.peerId === deleteConfirmPeerId) || null,
    [conversations, deleteConfirmPeerId]
  );
  const blockOptionsConversation = useMemo(
    () => conversations.find((conversation) => conversation.peerId === blockOptionsPeerId) || null,
    [conversations, blockOptionsPeerId]
  );

  useEffect(() => {
    if (!userId || conversations.length === 0) return;
    const queryPeer =
      searchParams.get('conversation_id')?.trim() ||
      searchParams.get('targetId')?.trim() ||
      '';
    if (queryPeer && conversations.some((c) => c.peerId === queryPeer)) {
      if (selectedPeerId !== queryPeer) setSelectedPeerId(queryPeer);
      return;
    }
    if (selectedPeerId && conversations.some((c) => c.peerId === selectedPeerId)) return;
    if (queryPeer) return;
    setSelectedPeerId(conversations[0].peerId);
  }, [conversations, selectedPeerId, userId, searchParams]);

  useEffect(() => {
    const view = (searchParams.get('view') || '').toLowerCase();
    if (view === 'inbox') {
      setMobileView('inbox');
    }
  }, [searchParams]);

  useEffect(() => {
    const targetId = searchParams.get('targetId');
    if (!targetId) return;
    if (!selectedPeerId) return;
    if (selectedPeerId !== targetId) return;
    setMobileView('chat');
  }, [searchParams, selectedPeerId]);

  useEffect(() => {
    if (!userId || !selectedPeerId) return;
    markConversationAsRead(userId, selectedPeerId);
  }, [selectedPeerId, userId, markConversationAsRead]);

  useEffect(() => {
    if (!userId) return;
    const incomingChannel = supabase
      .channel(`messages-incoming-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_user_id=eq.${userId}`,
        },
        async () => {
          const rows = await loadMessages(userId);
          runMessagesLoaded(userId, rows);
          if (selectedPeerId) await markConversationAsRead(userId, selectedPeerId);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('messages:updated'));
          }
        }
      )
      .subscribe();

    const outgoingChannel = supabase
      .channel(`messages-outgoing-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_user_id=eq.${userId}`,
        },
        async () => {
          const rows = await loadMessages(userId);
          runMessagesLoaded(userId, rows);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incomingChannel);
      supabase.removeChannel(outgoingChannel);
    };
  }, [loadMessages, markConversationAsRead, runMessagesLoaded, selectedPeerId, userId]);

  const activeMessages = useMemo(() => {
    if (!userId || !selectedPeerId) return [];
    return messages
      .filter(
        (m) =>
          (m.sender_user_id === userId && m.recipient_user_id === selectedPeerId) ||
          (m.sender_user_id === selectedPeerId && m.recipient_user_id === userId)
      )
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, selectedPeerId, userId]);

  const latestOutgoingUnreadMessageId = useMemo(() => {
    if (!userId) return null;
    for (let index = activeMessages.length - 1; index >= 0; index -= 1) {
      const msg = activeMessages[index];
      if (msg.sender_user_id === userId && !msg.read_at) return msg.id;
    }
    return null;
  }, [activeMessages, userId]);

  const visibleMessages = useMemo(() => {
    if (activeMessages.length <= visibleThreadCount) return activeMessages;
    return activeMessages.slice(activeMessages.length - visibleThreadCount);
  }, [activeMessages, visibleThreadCount]);

  const hasOlderMessages = activeMessages.length > visibleThreadCount;

  useEffect(() => {
    setVisibleThreadCount(THREAD_PAGE_SIZE);
    setLoadingOlder(false);
    shouldStickToBottomRef.current = true;
  }, [selectedPeerId]);

  useLayoutEffect(() => {
    if (!selectedPeerId) return;
    const changedConversation = previousSelectedPeerRef.current !== selectedPeerId;
    const gotNewMessage = activeMessages.length > previousActiveMessagesCountRef.current;
    if (changedConversation || (gotNewMessage && shouldStickToBottomRef.current)) {
      scheduleScrollThreadToBottom();
    }
    previousSelectedPeerRef.current = selectedPeerId;
    previousActiveMessagesCountRef.current = activeMessages.length;
  }, [selectedPeerId, activeMessages.length, scheduleScrollThreadToBottom]);

  const handleThreadScroll = useCallback(() => {
    const node = threadScrollRef.current;
    if (!node || !selectedPeerId) return;

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 96;

    if (loadingOlder || !hasOlderMessages) return;
    if (node.scrollTop > 40) return;
    setLoadingOlder(true);
    const previousHeight = node.scrollHeight;
    setVisibleThreadCount((prev) => prev + THREAD_PAGE_SIZE);
    requestAnimationFrame(() => {
      const updatedNode = threadScrollRef.current;
      if (updatedNode) {
        const nextHeight = updatedNode.scrollHeight;
        updatedNode.scrollTop = Math.max(0, nextHeight - previousHeight);
        const nextDistanceFromBottom = updatedNode.scrollHeight - updatedNode.scrollTop - updatedNode.clientHeight;
        shouldStickToBottomRef.current = nextDistanceFromBottom < 96;
      }
      setLoadingOlder(false);
    });
  }, [hasOlderMessages, loadingOlder, selectedPeerId]);

  const activeConversationLabel = selectedPeerId
    ? peerLabels[selectedPeerId] ||
      conversations.find((c) => c.peerId === selectedPeerId)?.label ||
      shortUser(selectedPeerId)
    : 'Select a conversation';

  const activeIntentMeta = useMemo(() => {
    if (!selectedPeerId || !intent || intent.userId !== selectedPeerId) return null;
    return { entityType: intent.entityType, entityId: intent.entityId, entityLabel: intent.label };
  }, [intent, selectedPeerId]);

  const activeItemPreview = useMemo(() => {
    if (!pendingItemPreview) return null;
    if (!selectedPeerId || !intent || intent.userId !== selectedPeerId) return null;
    return pendingItemPreview;
  }, [intent, pendingItemPreview, selectedPeerId]);

  const toInitials = useCallback((label: string) => {
    const clean = label.replace(/^@/, '').trim();
    if (!clean) return '?';
    const parts = clean.split(/[\s_]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }, []);

  const formatThreadTime = useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  const formatMessageDividerTime = useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: now.getFullYear() === date.getFullYear() ? undefined : 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  const formatFileSize = useCallback((size?: number | null) => {
    if (!size || size <= 0) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const formatItemPrice = useCallback((value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('$')) return raw;
    if (/^[A-Za-z]{3}\s+/.test(raw)) return raw;
    const numeric = Number(raw.replace(/,/g, ''));
    if (!Number.isNaN(numeric)) return `$${numeric.toLocaleString()}`;
    return `$${raw}`;
  }, []);

  const getMessagePreviewText = useCallback((text: string) => {
    const itemRef = parseItemReference(text);
    if (!itemRef) return text;
    if (itemRef.messageText) return itemRef.messageText;
    return `Item: ${itemRef.reference.title}`;
  }, [parseItemReference]);

  const renderMessageBody = useCallback((text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={`url-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={`txt-${index}`}>{part}</span>;
    });
  }, []);

  useEffect(() => {
    if (!openMenuPeerId) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.('[data-conversation-menu]')) {
        setOpenMenuPeerId(null);
        setMenuPosition(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuPeerId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [openMenuPeerId]);

  const closeLightbox = useCallback(() => {
    if (lightboxCloseTimerRef.current) {
      clearTimeout(lightboxCloseTimerRef.current);
      lightboxCloseTimerRef.current = null;
    }
    setLightboxVisible(false);
    lightboxCloseTimerRef.current = setTimeout(() => {
      setLightboxImageUrl(null);
      lightboxCloseTimerRef.current = null;
    }, 220);
  }, []);

  const openLightbox = useCallback((url: string, alt: string) => {
    if (lightboxCloseTimerRef.current) {
      clearTimeout(lightboxCloseTimerRef.current);
      lightboxCloseTimerRef.current = null;
    }
    setLightboxImageUrl(url);
    setLightboxImageAlt(alt || 'Image');
    requestAnimationFrame(() => setLightboxVisible(true));
  }, []);

  const closeItemPreviewPopup = useCallback(() => {
    if (itemPreviewCloseTimerRef.current) {
      clearTimeout(itemPreviewCloseTimerRef.current);
      itemPreviewCloseTimerRef.current = null;
    }
    setItemPreviewPopupVisible(false);
    itemPreviewCloseTimerRef.current = setTimeout(() => {
      setItemPreviewPopup(null);
      itemPreviewCloseTimerRef.current = null;
    }, 220);
  }, []);

  const openItemPreviewPopup = useCallback((context: ItemPreviewContext) => {
    if (itemPreviewCloseTimerRef.current) {
      clearTimeout(itemPreviewCloseTimerRef.current);
      itemPreviewCloseTimerRef.current = null;
    }
    setItemPreviewPopup(context);
    requestAnimationFrame(() => setItemPreviewPopupVisible(true));
  }, []);

  const closeItemPreviewActionModal = useCallback(() => {
    if (itemPreviewActionCloseTimerRef.current) {
      clearTimeout(itemPreviewActionCloseTimerRef.current);
      itemPreviewActionCloseTimerRef.current = null;
    }
    setItemPreviewActionVisible(false);
    itemPreviewActionCloseTimerRef.current = setTimeout(() => {
      setItemPreviewActionContext(null);
      itemPreviewActionCloseTimerRef.current = null;
    }, 200);
  }, []);

  const openItemPreviewActionModal = useCallback((context: ItemPreviewContext) => {
    if (itemPreviewActionCloseTimerRef.current) {
      clearTimeout(itemPreviewActionCloseTimerRef.current);
      itemPreviewActionCloseTimerRef.current = null;
    }
    setItemPreviewActionContext(context);
    requestAnimationFrame(() => setItemPreviewActionVisible(true));
  }, []);

  const openItemPage = useCallback((url: string) => {
    const target = (url || '').trim();
    if (!target) return;
    if (/^https?:\/\//i.test(target)) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    router.push(target);
  }, [router]);

  const handleItemPreviewAction = useCallback((action: 'preview' | 'page') => {
    if (!itemPreviewActionContext) return;
    const context = itemPreviewActionContext;
    closeItemPreviewActionModal();
    if (action === 'preview') {
      setTimeout(() => openItemPreviewPopup(context), 40);
      return;
    }
    openItemPage(context.url);
  }, [closeItemPreviewActionModal, itemPreviewActionContext, openItemPage, openItemPreviewPopup]);

  useEffect(() => {
    if (!lightboxImageUrl) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [closeLightbox, lightboxImageUrl]);

  useEffect(() => {
    if (!itemPreviewPopup) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeItemPreviewPopup();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [closeItemPreviewPopup, itemPreviewPopup]);

  useEffect(() => {
    if (!itemPreviewActionContext) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeItemPreviewActionModal();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [closeItemPreviewActionModal, itemPreviewActionContext]);

  useEffect(() => {
    return () => {
      if (lightboxCloseTimerRef.current) clearTimeout(lightboxCloseTimerRef.current);
      if (itemPreviewCloseTimerRef.current) clearTimeout(itemPreviewCloseTimerRef.current);
      if (itemPreviewActionCloseTimerRef.current) clearTimeout(itemPreviewActionCloseTimerRef.current);
    };
  }, []);

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }, []);

  const handleViewProfile = useCallback((peerId: string) => {
    const href = peerProfileLinks[peerId];
    if (href) router.push(href);
    setOpenMenuPeerId(null);
    setMenuPosition(null);
  }, [peerProfileLinks, router]);

  const handleDeleteChat = useCallback(async (peerId: string) => {
    if (!userId) return;
    setActionPeerId(peerId);
    const nowIso = new Date().toISOString();
    const { error: clearError } = await supabase
      .from('message_conversation_clears')
      .upsert(
        { user_id: userId, peer_id: peerId, cleared_at: nowIso, updated_at: nowIso },
        { onConflict: 'user_id,peer_id' }
      );
    if (clearError) {
      setError(clearError.message || 'Failed to delete chat');
    } else {
      setError(null);
      const rows = await loadMessages(userId);
      runMessagesLoaded(userId, rows);
      if (selectedPeerId === peerId) {
        setSelectedPeerId(null);
        setMobileView('inbox');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('messages:updated'));
      }
    }
    setActionPeerId(null);
    setOpenMenuPeerId(null);
    setMenuPosition(null);
  }, [loadMessages, runMessagesLoaded, selectedPeerId, userId]);

  const handleBlockProfileUser = useCallback(async (peerId: string) => {
    setActionPeerId(peerId);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch('/api/user/blocks', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ blockedUserId: peerId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || 'Failed to block user');
    } else {
      setError(null);
    }
    setActionPeerId(null);
    setOpenMenuPeerId(null);
    setMenuPosition(null);
    setBlockOptionsPeerId(null);
  }, [getAuthHeader]);

  const handleBlockMessagingOnly = useCallback(async (peerId: string) => {
    if (!userId) return;
    setActionPeerId(peerId);
    const { error: insertError } = await supabase
      .from('message_blocks')
      .insert({ blocker_id: userId, blocked_id: peerId });
    if (insertError) {
      if ((insertError as any)?.code === '23505') {
        setError('This user is already blocked from messaging you.');
      } else {
        setError(insertError.message || 'Failed to block user from messaging');
      }
    } else {
      setError(null);
    }
    setActionPeerId(null);
    setOpenMenuPeerId(null);
    setMenuPosition(null);
    setBlockOptionsPeerId(null);
  }, [userId]);

  const handleReportChat = useCallback(async (peerId: string, label: string) => {
    if (!userId) return;
    if (!window.confirm(`Report chat with ${label}?`)) return;
    setActionPeerId(peerId);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const entityId = [userId, peerId].sort().join(':');
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        entity_type: 'chat',
        entity_id: entityId,
        entity_title: `Chat with ${label}`,
        reason: 'Other',
        details: `Reported from inbox actions menu. Peer user id: ${peerId}`,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || 'Failed to report chat');
    } else {
      setError(null);
    }
    setActionPeerId(null);
    setOpenMenuPeerId(null);
    setMenuPosition(null);
  }, [getAuthHeader, userId]);

  const handleSend = async () => {
    if (!userId || !selectedPeerId || sending) return;
    const trimmed = draft.trim();
    if (!trimmed && !selectedAttachment && !activeItemPreview) return;
    if (selectedPeerId === userId) {
      setError('You cannot send messages to yourself.');
      return;
    }
    setSending(true);
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    let attachmentMime: string | null = null;
    let attachmentSize: number | null = null;

    if (selectedAttachment) {
      const cleanName = selectedAttachment.name.replace(/[^\w.\-]+/g, '_');
      const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${cleanName}`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('message-attachments')
        .upload(filePath, selectedAttachment, {
          upsert: false,
          contentType: selectedAttachment.type || undefined,
        });
      if (uploadError || !uploadData?.path) {
        setError(uploadError?.message || 'Failed to upload attachment');
        setSending(false);
        return;
      }
      const { data: publicData } = supabase.storage.from('message-attachments').getPublicUrl(uploadData.path);
      attachmentUrl = publicData?.publicUrl || null;
      attachmentName = selectedAttachment.name;
      attachmentMime = selectedAttachment.type || null;
      attachmentSize = selectedAttachment.size || null;
    }

    const messagePreviewForPush =
      trimmed.length > 0
        ? trimmed.length > 200
          ? `${trimmed.slice(0, 200)}…`
          : trimmed
        : selectedAttachment || attachmentUrl
          ? 'Sent an attachment'
          : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(await getAuthHeader()),
    };
    try {
      const res = await fetch('/api/messages/send-direct', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          recipient_user_id: selectedPeerId,
          body: activeItemPreview ? encodeBodyWithItemReference(activeItemPreview, trimmed) : trimmed,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_mime: attachmentMime,
          attachment_size: attachmentSize,
          recipient_entity_type: activeIntentMeta?.entityType || null,
          recipient_entity_id: activeIntentMeta?.entityId || null,
          recipient_entity_label: activeIntentMeta?.entityLabel || null,
          message_preview: messagePreviewForPush,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to send message',
        );
      } else {
        setError(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notifications:updated'));
          window.dispatchEvent(new CustomEvent('messages:updated'));
        }
        const push = payload?.push as { successCount?: number; failureCount?: number } | undefined;
        if (push && typeof push.successCount === 'number' && push.successCount === 0) {
          console.warn(
            '[messages] send-direct: no FCM device reached (recipient should open the app while logged in to register push).',
          );
        }
        setDraft('');
        setSelectedAttachment(null);
        if (activeItemPreview) setPendingItemPreview(null);
        const rows = await loadMessages(userId);
        runMessagesLoaded(userId, rows);
        scheduleScrollThreadToBottom();
      }
    } catch {
      setError('Failed to send message (network).');
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-slate-500">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="box-border h-[calc(100dvh-4rem-env(safe-area-inset-top,0px)-1.5rem-env(safe-area-inset-bottom,0px)-1rem)] overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 px-0 py-2 sm:h-auto sm:min-h-screen sm:px-4 sm:py-8">
      <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-auto sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
        <div className="grid min-h-0 flex-1 grid-cols-1 md:h-[70vh] md:grid-cols-[20rem_1fr]">
          <aside
            className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-b border-slate-200 md:border-b-0 md:border-r`}
          >
            <div className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
              <h1 className="text-xl font-semibold text-slate-900">Chats</h1>
              <p className="mt-1 text-xs text-slate-500">{conversations.length} people</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-slate-50/70 p-2 sm:max-h-[65vh] sm:bg-transparent sm:p-0 md:max-h-[calc(70vh-4.5rem)]">
              {conversations.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">No messages yet.</div>
              ) : (
                conversations.map((conversation) => {
                  const isActive = selectedPeerId === conversation.peerId;
                  const preview =
                    getMessagePreviewText(conversation.latestMessage.body || '') ||
                    conversation.latestMessage.attachment_name ||
                    (conversation.latestMessage.attachment_url ? 'Attachment' : 'Start a conversation');
                  return (
                    <div
                      key={conversation.peerId}
                      className={`relative mb-1.5 flex w-full items-start gap-2 rounded-2xl border border-slate-200/70 px-2 py-2 transition ${
                        isActive ? 'bg-indigo-50 ring-1 ring-indigo-100' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPeerId(conversation.peerId);
                          setMobileView('chat');
                          setOpenMenuPeerId(null);
                        }}
                        className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-1 text-left"
                      >
                        <div className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200">
                          {peerAvatarUrls[conversation.peerId] ? (
                            <img
                              src={peerAvatarUrls[conversation.peerId]}
                              alt={conversation.label}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-700">
                              {toInitials(conversation.label)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{conversation.label}</p>
                            <p className="shrink-0 text-[11px] text-slate-400">{formatThreadTime(conversation.latestMessage.created_at)}</p>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className={`truncate text-xs ${conversation.unreadCount > 0 ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>{preview}</p>
                            {conversation.unreadCount > 0 && (
                              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="relative pr-1" data-conversation-menu>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            const menuWidth = 176;
                            const top = rect.bottom + 6;
                            const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
                            if (openMenuPeerId === conversation.peerId) {
                              setOpenMenuPeerId(null);
                              setMenuPosition(null);
                            } else {
                              setOpenMenuPeerId(conversation.peerId);
                              setMenuPosition({ top, left });
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-700"
                          aria-label="Conversation actions"
                        >
                          ...
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          <section
            className={`${mobileView === 'inbox' ? 'hidden md:flex' : 'flex'} min-h-0 flex-1 flex-col md:h-[70vh] md:flex-none`}
          >
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileView('inbox')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 md:hidden"
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
                </button>
                {selectedPeerId && (
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-200">
                    {peerAvatarUrls[selectedPeerId] ? (
                      <img
                        src={peerAvatarUrls[selectedPeerId]}
                        alt={activeConversationLabel}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-slate-700">
                        {toInitials(activeConversationLabel)}
                      </div>
                    )}
                  </div>
                )}
                <p className="truncate text-sm font-semibold text-slate-900">{activeConversationLabel}</p>
              </div>
            </div>

            <div
              ref={threadScrollRef}
              onScroll={handleThreadScroll}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain bg-slate-50 px-3 py-3 pb-4 touch-pan-y sm:px-5 sm:py-4 sm:pb-6"
              style={{
                scrollPaddingBottom: '12px',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {selectedPeerId && hasOlderMessages && (
                <div className="pb-1 text-center text-[11px] font-medium text-slate-400">
                  {loadingOlder ? 'Loading older messages...' : 'Scroll up to load older messages'}
                </div>
              )}
              {!selectedPeerId ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
                  Select a conversation to start messaging.
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
                  No messages yet. Send the first message.
                </div>
              ) : (
                visibleMessages.map((msg, index) => {
                  const mine = msg.sender_user_id === userId;
                  const itemReference = parseItemReference(msg.body || '');
                  const messageBodyText = itemReference ? itemReference.messageText : msg.body;
                  const messageStatus = mine
                    ? msg.read_at
                      ? 'read'
                      : msg.id === latestOutgoingUnreadMessageId
                        ? 'sent'
                        : 'delivered'
                    : null;
                  const prev = index > 0 ? visibleMessages[index - 1] : null;
                  const prevDate = prev ? new Date(prev.created_at) : null;
                  const currDate = new Date(msg.created_at);
                  const crossedDay =
                    !!prevDate && prevDate.toDateString() !== currDate.toDateString();
                  const longGap =
                    !!prevDate &&
                    currDate.getTime() - prevDate.getTime() >= 30 * 60 * 1000;
                  const showDivider = index === 0 || crossedDay || longGap;
                  return (
                    <div key={msg.id}>
                      {showDivider && (
                        <div className="mb-2 mt-1 text-center text-[11px] font-medium text-slate-400">
                          {formatMessageDividerTime(msg.created_at)}
                        </div>
                      )}
                      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            mine ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800'
                          }`}
                        >
                          {itemReference && (
                            <button
                              type="button"
                              onClick={() => openItemPreviewActionModal(itemReference.reference)}
                              className={`mb-2 block w-full overflow-hidden rounded-xl border text-left transition ${
                                mine
                                  ? 'border-white/30 bg-indigo-500/40 hover:bg-indigo-500/60'
                                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                              }`}
                            >
                              {itemReference.reference.imageUrl ? (
                                <img
                                  src={itemReference.reference.imageUrl}
                                  alt={itemReference.reference.title}
                                  className="h-32 w-full bg-slate-100 object-contain"
                                />
                              ) : null}
                              <div className="px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide opacity-75">Item preview</p>
                                <p className="truncate font-semibold">{itemReference.reference.title}</p>
                              </div>
                            </button>
                          )}
                          {!!messageBodyText && (
                            <p className="whitespace-pre-wrap break-words">{renderMessageBody(messageBodyText)}</p>
                          )}
                          {msg.attachment_url && (
                            <div className={msg.body ? 'mt-2' : ''}>
                              {String(msg.attachment_mime || '').startsWith('image/') ? (
                                <img
                                  src={msg.attachment_url}
                                  alt={msg.attachment_name || 'Image attachment'}
                                  className="block max-h-64 max-w-full rounded-xl border border-black/10 object-contain touch-pan-y"
                                  onClick={() => {
                                    if (!msg.attachment_url) return;
                                    openLightbox(msg.attachment_url, msg.attachment_name || 'Image attachment');
                                  }}
                                  onLoad={() => {
                                    if (shouldStickToBottomRef.current) {
                                      scheduleScrollThreadToBottom();
                                    }
                                  }}
                                />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`block rounded-lg border px-3 py-2 text-xs ${
                                    mine
                                      ? 'border-indigo-300/60 bg-indigo-500/50 text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <p className="truncate font-semibold">
                                    {msg.attachment_name || 'Attachment'}
                                  </p>
                                  {msg.attachment_size ? (
                                    <p className="mt-0.5 opacity-80">{formatFileSize(msg.attachment_size)}</p>
                                  ) : null}
                                </a>
                              )}
                            </div>
                          )}
                          {messageStatus && (
                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                                messageStatus === 'read' ? 'text-sky-200' : 'text-white/80'
                              }`}
                              aria-label={`Message ${messageStatus}`}
                            >
                              {messageStatus === 'read' ? (
                                <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
                              ) : messageStatus === 'delivered' ? (
                                <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
                              ) : (
                                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_20px_rgba(15,23,42,0.06)] sm:p-4 sm:shadow-none">
              {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
              {activeItemPreview && (
                <div className="relative mb-2">
                  <button
                    type="button"
                    onClick={() => openItemPreviewActionModal(activeItemPreview)}
                    className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 pr-10 text-left transition hover:bg-slate-100"
                  >
                    {activeItemPreview.imageUrl ? (
                      <img
                        src={activeItemPreview.imageUrl}
                        alt={activeItemPreview.title}
                        className="h-28 w-full bg-slate-100 object-contain"
                      />
                    ) : null}
                    <div className="px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Sending about this item
                      </p>
                      <p className="truncate text-sm font-semibold text-slate-800">{activeItemPreview.title}</p>
                      {activeItemPreview.price ? (
                        <p className="mt-0.5 text-xs font-semibold text-emerald-700">{formatItemPrice(activeItemPreview.price)}</p>
                      ) : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingItemPreview(null)}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Remove item from message"
                    title="Remove item"
                  >
                    x
                  </button>
                </div>
              )}
              {selectedAttachment && (
                <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="truncate pr-2">
                      {selectedAttachment.name}
                      {selectedAttachment.size ? ` (${formatFileSize(selectedAttachment.size)})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedAttachment(null)}
                      className="rounded px-2 py-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                      aria-label="Remove attachment"
                    >
                      x
                    </button>
                  </div>
                  {selectedAttachmentPreviewUrl && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      <img
                        src={selectedAttachmentPreviewUrl}
                        alt="Selected image preview"
                        className="max-h-56 w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSelectedAttachment(file);
                    event.currentTarget.value = '';
                  }}
                />
                <div className="relative flex-1">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    placeholder={selectedPeerId ? 'Type a message...' : 'Select a conversation first'}
                    disabled={!selectedPeerId || sending}
                    className="min-h-[2.75rem] w-full resize-none rounded-xl border border-slate-300 px-3 py-2 pr-12 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={!selectedPeerId || sending}
                    className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center text-[#c02662] transition hover:text-[#db2777] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Add media"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!selectedPeerId || sending || (!draft.trim() && !selectedAttachment && !activeItemPreview)}
                  className="inline-flex h-11 self-center items-center justify-center px-1 text-blue-600 transition-colors duration-200 hover:text-blue-500 active:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
                  aria-label="Send message"
                >
                  {sending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500/60 border-t-transparent" />
                  ) : (
                    <Send className="-translate-y-0.5 -rotate-90 h-7 w-7" strokeWidth={2.6} />
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      {openMenuPeerId && activeMenuConversation && menuPosition && (
        <div
          data-conversation-menu
          className="fixed z-[120] min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
        >
          <button
            type="button"
            onClick={() => handleViewProfile(activeMenuConversation.peerId)}
            className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            View profile
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmPeerId(activeMenuConversation.peerId);
              setOpenMenuPeerId(null);
              setMenuPosition(null);
            }}
            className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Delete chat
          </button>
          <button
            type="button"
            onClick={() => {
              setBlockOptionsPeerId(activeMenuConversation.peerId);
              setOpenMenuPeerId(null);
              setMenuPosition(null);
            }}
            className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Block user
          </button>
          <button
            type="button"
            onClick={() => handleReportChat(activeMenuConversation.peerId, activeMenuConversation.label)}
            className="block w-full px-3 py-2.5 text-left text-xs font-medium text-red-600 transition hover:bg-red-50"
          >
            {actionPeerId === activeMenuConversation.peerId ? 'Working...' : 'Report chat'}
          </button>
        </div>
      )}
      {deleteConfirmPeerId && deleteConfirmConversation && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-900">Delete chat?</h3>
            <p className="mt-2 text-xs text-slate-600">
              This will remove all messages with {deleteConfirmConversation.label}. This action cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPeerId(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const peerId = deleteConfirmPeerId;
                  if (!peerId) return;
                  setDeleteConfirmPeerId(null);
                  await handleDeleteChat(peerId);
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
      {blockOptionsPeerId && blockOptionsConversation && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-900">Block user</h3>
            <p className="mt-2 text-xs text-slate-600">
              Choose how you want to block {blockOptionsConversation.label}.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (!blockOptionsPeerId) return;
                  handleBlockMessagingOnly(blockOptionsPeerId);
                }}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {actionPeerId === blockOptionsPeerId ? 'Working...' : 'Block user from messaging me'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!blockOptionsPeerId) return;
                  handleBlockProfileUser(blockOptionsPeerId);
                }}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {actionPeerId === blockOptionsPeerId ? 'Working...' : 'Block user profile'}
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setBlockOptionsPeerId(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {lightboxImageUrl && (
        <div
          className={`fixed inset-0 z-[140] flex items-center justify-center overflow-hidden p-3 transition-all duration-200 ease-out sm:p-4 ${
            lightboxVisible ? 'bg-black/85 opacity-100' : 'bg-black/0 opacity-0'
          }`}
          onClick={closeLightbox}
        >
          <div
            className={`relative transform transition-all duration-200 ease-out ${
              lightboxVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={lightboxImageUrl}
              alt={lightboxImageAlt}
              className="h-auto w-auto max-h-[calc(100dvh-4.5rem)] max-w-[calc(100vw-1.5rem)] rounded-xl object-contain shadow-2xl sm:max-h-[calc(100dvh-5rem)] sm:max-w-[calc(100vw-3rem)]"
            />
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white/95 text-xl font-bold leading-none text-slate-900 shadow-lg transition hover:scale-105 hover:bg-white"
              aria-label="Close image preview"
            >
              X
            </button>
          </div>
        </div>
      )}
      {itemPreviewPopup && (
        <div
          className={`fixed inset-0 z-[145] flex items-center justify-center overflow-hidden p-3 transition-all duration-200 ease-out sm:p-4 ${
            itemPreviewPopupVisible ? 'bg-black/70 opacity-100' : 'bg-black/0 opacity-0'
          }`}
          onClick={closeItemPreviewPopup}
        >
          <div
            className={`w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-200 ease-out ${
              itemPreviewPopupVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            {itemPreviewPopup.imageUrl ? (
              <img
                src={itemPreviewPopup.imageUrl}
                alt={itemPreviewPopup.title}
                className="h-60 w-full bg-slate-100 object-contain"
              />
            ) : (
              <div className="flex h-36 items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">
                No image available
              </div>
            )}
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Item preview</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{itemPreviewPopup.title}</p>
              {itemPreviewPopup.price ? (
                <p className="mt-1 text-sm font-semibold text-emerald-700">{formatItemPrice(itemPreviewPopup.price)}</p>
              ) : null}
              {itemPreviewPopup.description ? (
                <p className="mt-2 max-h-28 overflow-y-auto text-sm leading-relaxed text-slate-600">
                  {itemPreviewPopup.description}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No description available.</p>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeItemPreviewPopup}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {itemPreviewActionContext && (
        <div
          className={`fixed inset-0 z-[146] flex items-center justify-center bg-black/20 p-3 transition-all duration-200 ${
            itemPreviewActionVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeItemPreviewActionModal}
        >
          <div
            className={`w-full max-w-[12.5rem] rounded-xl border border-slate-200 bg-white p-2 shadow-xl transition-all duration-200 ${
              itemPreviewActionVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleItemPreviewAction('preview')}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => handleItemPreviewAction('page')}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Page</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-sm text-slate-500">Loading messages...</p>
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
