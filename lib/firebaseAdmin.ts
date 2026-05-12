/**
 * Firebase Admin FCM: Hanar push payloads with explicit Android notification text,
 * high priority, Hanar channel, and data keys (type, link, senderId) for the native app.
 *
 * Set FIREBASE_SERVICE_ACCOUNT_JSON (full JSON string) to enable sending.
 */

let messaging: import('firebase-admin').messaging.Messaging | null = null;

function getMessaging(): import('firebase-admin').messaging.Messaging | null {
  if (messaging !== undefined) return messaging;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json || typeof json !== 'string') {
    messaging = null;
    return null;
  }
  try {
    const credential = JSON.parse(json);
    if (!credential.project_id || !credential.private_key || !credential.client_email) {
      messaging = null;
      return null;
    }
    const admin = require('firebase-admin') as typeof import('firebase-admin');
    if (!admin.apps?.length) {
      admin.initializeApp({ credential: admin.credential.cert(credential) });
    }
    messaging = admin.messaging();
  } catch {
    messaging = null;
  }
  return messaging;
}

export function isPushConfigured(): boolean {
  return getMessaging() != null;
}

/** Matches Flutter `kAndroidFcmNotificationChannelId` + AndroidManifest default channel. */
export const ANDROID_FCM_HIGH_CHANNEL_ID = 'hanar_high_importance_channel';

const DEFAULT_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://www.hanar.net';

export type PushFcmExtras = {
  /** Sent as `data.type` for client routing (e.g. direct_message, community_reply). */
  type?: string;
  /** Sent as `data.senderId` when the acting user is known. */
  senderId?: string | null;
};

/** Trims and caps display length for notification body lines (Unicode-aware spread). */
export function truncateForPushBody(text: string, maxChars: number): string {
  const t = String(text ?? '').trim();
  if (maxChars <= 0) return '';
  const chars = [...t];
  if (chars.length <= maxChars) return t;
  return `${chars.slice(0, maxChars).join('')}…`;
}

/** Ensures a single leading @ for display handles (never "@@user"). */
export function formatAtHandle(handleOrMention: string): string {
  const raw = String(handleOrMention ?? '').trim().replace(/^@+/u, '');
  if (!raw) return '@someone';
  return `@${raw}`;
}

/**
 * Absolute https URL for WebView / PWA. Pass a full URL or a site path (/messages?...).
 */
export function toAbsoluteHanarLink(pathOrUrl: string | null | undefined): string | null {
  if (pathOrUrl == null) return null;
  const s = String(pathOrUrl).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${DEFAULT_SITE_ORIGIN}${path}`;
}

function safeNotificationTitleBody(title: string, body: string): { title: string; body: string } {
  const t = String(title ?? '').trim() || 'Hanar';
  const b = String(body ?? '').trim() || 'Open to view.';
  return { title: t, body: b };
}

/** Normalized payload from a `build*PushContent` helper (or explicit campaign copy). */
export type HanarPushBuilt = {
  title: string;
  body: string;
  linkPath: string | null;
  type: string;
  senderId?: string;
};

/**
 * Send FCM with both `notification` and `data` (not data-only). Prefer this over calling
 * {@link sendPushToTokens} with loose strings so every push uses the same shape.
 */
export async function sendPushToTokensBuilt(
  push: HanarPushBuilt,
  tokens: string[]
): Promise<{ successCount: number; failureCount: number }> {
  return sendPushToTokens(push.title, push.body, push.linkPath, tokens, {
    type: push.type,
    senderId: push.senderId,
  });
}

/**
 * Send FCM with both `notification` and `data` (not data-only). Android uses HIGH priority,
 * `android.notification.channelId` (FCM REST: channel_id), and duplicates title/body on
 * `android.notification` so the tray never falls back to generic OEM text.
 */
export async function sendPushToTokens(
  title: string,
  body: string,
  urlOrPath: string | null,
  tokens: string[],
  extras?: PushFcmExtras
): Promise<{ successCount: number; failureCount: number }> {
  const m = getMessaging();
  if (!m || !tokens.length) {
    return { successCount: 0, failureCount: tokens.length ? tokens.length : 0 };
  }

  const { title: safeTitle, body: safeBody } = safeNotificationTitleBody(title, body);
  const linkAbs = toAbsoluteHanarLink(urlOrPath);

  const data: Record<string, string> = {
    type: (extras?.type ?? 'hanar').trim() || 'hanar',
  };
  if (linkAbs) {
    data.link = linkAbs;
    data.url = linkAbs;
  }
  const sid = extras?.senderId != null ? String(extras.senderId).trim() : '';
  if (sid) {
    data.senderId = sid;
  }

  const batchSize = 500;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tokens.length; i += batchSize) {
    const chunk = tokens.slice(i, i + batchSize);
    const result = await m.sendEachForMulticast({
      notification: { title: safeTitle, body: safeBody },
      data,
      tokens: chunk,
      android: {
        priority: 'high',
        notification: {
          channelId: ANDROID_FCM_HIGH_CHANNEL_ID,
          title: safeTitle,
          body: safeBody,
        },
      },
    });
    successCount += result.successCount;
    failureCount += result.failureCount;
  }
  return { successCount, failureCount };
}

// --- Typed copy helpers (call sites pass results into sendPushToTokens / sendPushToUserIds) ---

export function buildDirectMessagePushContent(args: {
  senderHandle: string;
  messagePreview: string;
  senderUserId: string;
}): HanarPushBuilt {
  const mention = formatAtHandle(args.senderHandle);
  const peer = encodeURIComponent(args.senderUserId);
  return {
    title: `${mention} sent you a message`,
    body: truncateForPushBody(args.messagePreview, 80),
    // Matches /messages deep-link resolution (resolveIntentFromQuery). Also include
    // conversation_id for older app links and Flutter WebView payloads.
    linkPath: `/messages?targetType=user&targetId=${peer}&conversation_id=${peer}`,
    type: 'direct_message',
    senderId: args.senderUserId,
  };
}

export function buildCommunityReplyPushContent(args: {
  senderHandle: string;
  replyPreview: string;
  postId: string;
  senderUserId: string;
}): HanarPushBuilt {
  const mention = formatAtHandle(args.senderHandle);
  return {
    title: `${mention} replied to your post`,
    body: truncateForPushBody(args.replyPreview, 80),
    linkPath: `/community/post/${args.postId}`,
    type: 'community_reply',
    senderId: args.senderUserId,
  };
}

export function buildPostLikedPushContent(args: {
  senderHandle: string;
  postTitleOrPreview: string;
  postId: string;
  senderUserId: string;
}): HanarPushBuilt {
  const mention = formatAtHandle(args.senderHandle);
  const preview = truncateForPushBody(args.postTitleOrPreview, 80);
  return {
    title: `${mention} liked your post`,
    body: preview || 'Your post',
    linkPath: `/community/post/${args.postId}`,
    type: 'post_liked',
    senderId: args.senderUserId,
  };
}

export function buildCommentLikedPushContent(args: {
  senderHandle: string;
  commentPreview: string;
  postId: string | null;
  senderUserId: string;
}): HanarPushBuilt {
  const mention = formatAtHandle(args.senderHandle);
  const path = args.postId ? `/community/post/${args.postId}` : '/notifications';
  return {
    title: `${mention} liked your comment`,
    body: truncateForPushBody(args.commentPreview, 80) || 'Your comment',
    linkPath: path,
    type: 'comment_liked',
    senderId: args.senderUserId,
  };
}

export function buildBusinessApprovedPushContent(args: {
  businessName: string;
  slug: string | null | undefined;
}): HanarPushBuilt {
  const name = String(args.businessName ?? '').trim() || 'Your business';
  const slug = (args.slug || '').trim();
  return {
    title: 'Your business was approved',
    body: truncateForPushBody(name, 80),
    linkPath: slug ? `/business/${slug}` : '/business-dashboard',
    type: 'business_approved',
  };
}
