-- Create materials storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'materials');

-- Create policy to allow public read access to materials
CREATE POLICY "Allow public read access to materials"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'materials');

-- Create policy to allow users to update their own files
CREATE POLICY "Allow users to update their own materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'materials');

-- Create policy to allow users to delete their own files
CREATE POLICY "Allow users to delete their own materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'materials');
