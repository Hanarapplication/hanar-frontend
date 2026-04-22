type ActorLabel = {
  mention: string;
  display: string;
};

function normalizeHandle(value: string | null | undefined): string {
  const v = String(value || '').trim().replace(/^@+/, '');
  return v;
}

function asMention(handle: string | null | undefined): string | null {
  const h = normalizeHandle(handle);
  return h ? `@${h}` : null;
}

export async function resolveNotificationActorLabel(
  supabaseAdmin: any,
  userId: string | null | undefined
): Promise<ActorLabel> {
  if (!supabaseAdmin || !userId) {
    return { mention: 'Someone', display: 'Someone' };
  }

  try {
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('slug, business_name')
      .eq('owner_id', userId)
      .maybeSingle();

    const businessMention = asMention((business as { slug?: string | null } | null)?.slug);
    if (businessMention) {
      return {
        mention: businessMention,
        display:
          (business as { business_name?: string | null } | null)?.business_name?.trim() ||
          businessMention,
      };
    }

    const { data: organization } = await supabaseAdmin
      .from('organizations')
      .select('username, full_name')
      .eq('user_id', userId)
      .maybeSingle();

    const orgMention = asMention((organization as { username?: string | null } | null)?.username);
    if (orgMention) {
      return {
        mention: orgMention,
        display:
          (organization as { full_name?: string | null } | null)?.full_name?.trim() || orgMention,
      };
    }

    const { data: account } = await supabaseAdmin
      .from('registeredaccounts')
      .select('username, full_name')
      .eq('user_id', userId)
      .maybeSingle();

    const accountMention = asMention((account as { username?: string | null } | null)?.username);
    if (accountMention) {
      return {
        mention: accountMention,
        display: (account as { full_name?: string | null } | null)?.full_name?.trim() || accountMention,
      };
    }

    const fullName = (account as { full_name?: string | null } | null)?.full_name?.trim();
    if (fullName) {
      return { mention: fullName, display: fullName };
    }
  } catch {
    // Keep fallback.
  }

  return { mention: 'Someone', display: 'Someone' };
}

