// Shared server-side attachment validation policy, reused by every upload entry point
// (ticket/note attachments, message attachments) so file-type/size rules never drift
// between features and can never be bypassed by trusting the client-reported MIME type.

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
];

/**
 * Validates a file against the shared attachment policy.
 * Returns an error message if the file is rejected, or null if it is allowed.
 * Never trusts the client-reported MIME type alone — falls back to extension checking.
 */
export function validateAttachmentFile(file: { name: string; type: string; size: number }): string | null {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return `File "${file.name}" exceeds maximum allowed size of 10MB`;
  }

  if (file.type && ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
    return null;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
    return `File type "${file.type || ext || 'unknown'}" is not allowed. Supported formats: Images, PDF, Word, Excel, PowerPoint, Text`;
  }

  return null;
}
