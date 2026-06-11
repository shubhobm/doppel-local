export type UploadDocumentRecord = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  chunkCount: number;
};

type UploadSingleFile = (file: File) => Promise<{
  ok: boolean;
  documents: UploadDocumentRecord[];
}>;

type UploadFilesOptions = {
  timeoutMs?: number;
};

export async function uploadFilesSequentially(
  files: File[],
  uploadSingleFile: UploadSingleFile,
  options?: UploadFilesOptions
) {
  const uploadedDocs: UploadDocumentRecord[] = [];
  const failedFiles: string[] = [];
  const timeoutMs = options?.timeoutMs ?? 120000;

  for (const file of files) {
    try {
      const result = await Promise.race([
        uploadSingleFile(file),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), timeoutMs);
        })
      ]);

      if (!result.ok) {
        failedFiles.push(file.name);
        continue;
      }

      if (result.documents.length) {
        uploadedDocs.push(...result.documents);
      }
    } catch {
      failedFiles.push(file.name);
    }
  }

  return { uploadedDocs, failedFiles };
}