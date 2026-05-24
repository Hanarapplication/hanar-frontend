/** True when the record was created via an admin flow (create-business / create-organization). */
export function isAdminAddedAccount(
  row: { admin_added_at?: string | null } | null | undefined
): boolean {
  return Boolean(row?.admin_added_at);
}
