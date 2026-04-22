-- Storage bucket + policies for direct message attachments.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('message-attachments', 'message-attachments', true, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS message_attachments_insert ON storage.objects;
CREATE POLICY message_attachments_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

DROP POLICY IF EXISTS message_attachments_update ON storage.objects;
CREATE POLICY message_attachments_update
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'message-attachments')
WITH CHECK (bucket_id = 'message-attachments');

DROP POLICY IF EXISTS message_attachments_delete ON storage.objects;
CREATE POLICY message_attachments_delete
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-attachments');

DROP POLICY IF EXISTS message_attachments_select ON storage.objects;
CREATE POLICY message_attachments_select
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'message-attachments');
