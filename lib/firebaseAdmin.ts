/**
 * Firebase Admin FCM: Hanar push payloads with explicit Android notification text,
 * high priority, Hanar channel, and data keys (type, link, senderId) for the native app.
 *
 * Set FIREBASE_SERVICE_ACCOUNT_JSON (full JSON string) to enable sending.
 *
 * Native shell contract (Flutter WebView):
 * - After login the web app redirects to `hanar://auth?...` when the shell is detected; the app
 *   stores the Supabase JWT and registers FCM via `POST /api/push/register-token` with Bearer auth.
 * - Tray delivery when backgrounded/killed requires a `notification` object (not data-only),
 *   plus `data` for routing. Android uses `android.notification.channel_id` =
 *   `hanar_high_importance_channel` (must match the Flutter default channel).
 * - Do **not** set top-level `notification.icon` to an https URL — Android expects a drawable
 *   resource name. Web icons go under `webpush.notification.icon` / `badge`.
 * - Web/PWA clients: expanded tray uses `webpush.notification.icon`; limited space uses `badge`
 *   (`/icons/notification-status-badge.png`). Native Android status-bar glyph must still match a
 *   white-on-transparent drawable in the Flutter APK (`ic_notification_hanar`); URLs do not replace that bitmap.
 * - We do not set a global `collapse_key` for distinct DMs/alerts so FCM does not replace
 *   unrelated messages; omit per-message collapse unless product explicitly wants collapsing.
 */

/** `undefined` = not yet initialized; `null` = init failed or missing env; otherwise Firebase Messaging. */
let messaging: import('firebase-admin').messaging.Messaging | null | undefined = undefined;

function getMessaging(): import('firebase-admin').messaging.Messaging | null {
  if (messaging !== undefined) return messaging;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json || typeof json !== 'string') {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT_JSON is missing or not a string — server pushes disabled');
    messaging = null;
    return null;
  }
  try {
    const credential = JSON.parse(json);
    if (!credential.project_id || !credential.private_key || !credential.client_email) {
      console.warn(
        '[push] FIREBASE_SERVICE_ACCOUNT_JSON parsed but missing project_id, private_key, or client_email',
      );
      messaging = null;
      return null;
    }
    const admin = require('firebase-admin') as typeof import('firebase-admin');
    if (!admin.apps?.length) {
      admin.initializeApp({ credential: admin.credential.cert(credential) });
    }
    messaging = admin.messaging();
    console.log('[push] Firebase Admin messaging initialized', { projectId: credential.project_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[push] FIREBASE_SERVICE_ACCOUNT_JSON parse or Admin init failed:', msg);
    messaging = null;
  }
  return messaging;
}

export function isPushConfigured(): boolean {
  return getMessaging() != null;
}

/** Matches Flutter `kAndroidFcmNotificationChannelId` + AndroidManifest default channel. */
export const ANDROID_FCM_HIGH_CHANNEL_ID = 'hanar_high_importance_channel';

/** Monochrome-ish mark for Web Notification `badge` (status bar / limited space); path under `public/`. */
const NOTIFICATION_BADGE_PATH = '/icons/notification-status-badge.png';

const DEFAULT_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://www.hanar.net';

export type PushFcmExtras = {
  /** Sent as `data.type` for client routing (e.g. direct_message, community_reply). */
  type?: string;
  /** Sent as `data.senderId` when the acting user is known. */
  senderId?: string | null;
  /** DM idempotency / deep-link (native `type: dm`). */
  messageId?: string;
  /** Peer user id for 1:1 threads (same as sender for recipient). */
  conversationId?: string;
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
  messageId?: string;
  conversationId?: string;
};

/** Outcome of {@link sendPushToTokens} / {@link sendPushToTokensBuilt}. */
export type FcmSendResult = {
  successCount: number;
  failureCount: number;
  /** Tokens FCM marked as invalid — remove from `user_push_tokens` and `push_tokens`. */
  invalidTokens: string[];
  /** Per-token failure details (codes/messages only; never raw tokens). */
  errors: { code?: string; message: string }[];
};

function isPermanentInvalidFcmToken(code: string | undefined): boolean {
  return (
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/registration-token-not-registered'
  );
}

/**
 * Send FCM with both `notification` and `data` (not data-only). Prefer this over calling
 * {@link sendPushToTokensBuilt} from feature code when you already have a {@link HanarPushBuilt}.
 */
export async function sendPushToTokensBuilt(
  push: HanarPushBuilt,
  tokens: string[]
): Promise<FcmSendResult> {
  return sendPushToTokens(push.title, push.body, push.linkPath, tokens, {
    type: push.type,
    senderId: push.senderId,
    messageId: push.messageId,
    conversationId: push.conversationId,
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
): Promise<FcmSendResult> {
  const invalidTokens: string[] = [];
  const errors: { code?: string; message: string }[] = [];
  const m = getMessaging();
  if (!m || !tokens.length) {
    if (tokens.length > 0 && !m) {
      console.warn('[push] sendPushToTokens skipped: Firebase Admin not available', {
        tokenCount: tokens.length,
      });
    }
    return {
      successCount: 0,
      failureCount: tokens.length ? tokens.length : 0,
      invalidTokens,
      errors,
    };
  }

  const { title: safeTitle, body: safeBody } = safeNotificationTitleBody(title, body);
  const linkAbs = toAbsoluteHanarLink(urlOrPath);
  const largeIconAbs = toAbsoluteHanarLink('/icons/icon-512.png');
  const badgeAbs = toAbsoluteHanarLink(NOTIFICATION_BADGE_PATH);

  const data: Record<string, string> = {
    type: (extras?.type ?? 'hanar').trim() || 'hanar',
  };
  const isDm = data.type === 'dm';
  if (!isDm && linkAbs) {
    data.link = linkAbs;
    data.url = linkAbs;
  }
  const sid = extras?.senderId != null ? String(extras.senderId).trim() : '';
  if (sid) {
    data.senderId = sid;
  }
  const mid = extras?.messageId != null ? String(extras.messageId).trim() : '';
  if (mid) {
    data.messageId = mid;
    // Unique tag so tray / Web Notifications do not replace unrelated pushes (default was `hanar-push`).
    data.tag = `hanar-${data.type}-${mid}`;
  }
  const conv = extras?.conversationId != null ? String(extras.conversationId).trim() : '';
  if (conv) {
    data.conversationId = conv;
  }
  // DM: `path` for app-relative routing; absolute `url`/`link` so clients that only read
  // `url` still deep-link, and tray delivery matches other notification types.
  if (isDm && urlOrPath && String(urlOrPath).trim().startsWith('/')) {
    data.path = String(urlOrPath).trim();
    if (linkAbs) {
      data.link = linkAbs;
      data.url = linkAbs;
    }
  }
  if (badgeAbs) {
    data.badge = badgeAbs;
  }

  const batchSize = 500;
  let successCount = 0;
  let failureCount = 0;

  const androidNotificationTag = data.tag;

  for (let i = 0; i < tokens.length; i += batchSize) {
    const chunk = tokens.slice(i, i + batchSize);
    // IMPORTANT: do not put an https URL on top-level `notification.icon`.
    // Android treats `icon` as a drawable resource name; a URL can suppress tray
    // display when the app is backgrounded/killed. Web icons belong under `webpush`.
    const result = await m.sendEachForMulticast({
      notification: {
        title: safeTitle,
        body: safeBody,
      },
      data,
      tokens: chunk,
      android: {
        priority: 'high',
        // Keep message eligible for prompt delivery after short offline / Doze windows.
        ttl: 86_400_000,
        notification: {
          channelId: ANDROID_FCM_HIGH_CHANNEL_ID,
          title: safeTitle,
          body: safeBody,
          // Omit icon here — Manifest `default_notification_icon` + Flutter drawable.
          ...(androidNotificationTag ? { tag: androidNotificationTag } : {}),
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
          // Client-side priority: heads-up / lock screen (channel must also be high importance in the app).
          priority: 'max',
        },
      },
      webpush: {
        notification: {
          title: safeTitle,
          body: safeBody,
          ...(largeIconAbs ? { icon: largeIconAbs } : {}),
          ...(badgeAbs ? { badge: badgeAbs } : {}),
          ...(linkAbs ? { data: { url: linkAbs } } : {}),
        },
        ...(linkAbs
          ? {
              fcmOptions: {
                link: linkAbs,
              },
            }
          : {}),
      },
      // Full alert + alert push type so iOS presents on lock screen / screen off (not only data-silent).
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            alert: {
              title: safeTitle,
              body: safeBody,
            },
            sound: 'default',
          },
        },
      },
    });
    successCount += result.successCount;
    failureCount += result.failureCount;

    console.log('[push] FCM multicast batch', {
      tokenCount: chunk.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
    if (result.failureCount > 0) {
      result.responses.forEach((r, idx) => {
        if (!r.success && r.error) {
          const code = r.error.code;
          errors.push({ code, message: r.error.message });
          console.error('[push] FCM per-token failure', {
            batchIndex: idx,
            code,
            message: r.error.message,
          });
          if (isPermanentInvalidFcmToken(code)) {
            const t = chunk[idx];
            if (t) invalidTokens.push(t);
          }
        }
      });
    }
  }
  return { successCount, failureCount, invalidTokens, errors };
}

// --- Typed copy helpers (call sites pass results into sendPushToTokens / sendPushToUserIds) ---

export function buildDirectMessagePushContent(args: {
  senderHandle: string;
  messagePreview: string;
  senderUserId: string;
  messageId: string;
}): HanarPushBuilt {
  const mention = formatAtHandle(args.senderHandle);
  const peerEnc = encodeURIComponent(args.senderUserId);
  return {
    title: `${mention} sent you a message`,
    body: truncateForPushBody(args.messagePreview, 80),
    linkPath: `/messages?conversation_id=${peerEnc}`,
    type: 'dm',
    senderId: args.senderUserId,
    messageId: args.messageId,
    conversationId: args.senderUserId,
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
