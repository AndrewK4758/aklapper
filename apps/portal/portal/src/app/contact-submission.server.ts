import { createHash } from 'node:crypto';

import {
  CONTACT_MAX_FILE_BYTES,
  type ContactActionResult,
  type ContactAttachment,
  ContactFormSubmissionSchema,
  type FormFieldErrorMap,
  resolveAllowedMimeType,
  sanitizeFilename,
  validateFormValues,
} from '@aklapper/core';
import {
  ContactDbConstraintError,
  getSharedDb,
  insertContactSubmission,
  loadPortalContactData,
} from '@aklapper/db';

function addFieldError(map: FormFieldErrorMap, field: string, message: string): void {
  const existing = map[field];
  if (existing) {
    if (!existing.includes(message)) {
      existing.push(message);
    }
  } else {
    map[field] = [message];
  }
}

export interface ContactSubmissionHttpResult {
  readonly payload: ContactActionResult;
  readonly status: number;
}

export async function processContactSubmission(
  request: Request,
): Promise<ContactSubmissionHttpResult> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return {
      status: 400,
      payload: {
        ok: false,
        source: 'server',
        formError: 'Malformed form submission payload. Expected multipart/form-data.',
        fieldErrors: {},
      },
    };
  }

  const db = getSharedDb();
  const { content } = await loadPortalContactData(db);

  const rawName = String(formData.get('name') ?? '');
  const rawPhone = String(formData.get('phone') ?? '');
  const rawEmail = String(formData.get('email') ?? '');
  const rawMessage = String(formData.get('message') ?? '');
  const rawFileEntry = formData.get('file');
  const uploadedFile =
    rawFileEntry instanceof File && (rawFileEntry.name.length > 0 || rawFileEntry.size > 0)
      ? rawFileEntry
      : null;

  const definitionValidation = validateFormValues(content.form, {
    name: rawName,
    phone: rawPhone,
    email: rawEmail,
    message: rawMessage,
    file: uploadedFile
      ? {
          name: uploadedFile.name,
          size: uploadedFile.size,
          type: uploadedFile.type,
        }
      : null,
  });

  if (!definitionValidation.valid) {
    return {
      status: 400,
      payload: {
        ok: false,
        source: 'server',
        formError: 'Server validation rejected the transmission. Fix the highlighted fields.',
        fieldErrors: definitionValidation.fieldErrors,
      },
    };
  }

  let attachment: ContactAttachment | null = null;
  if (uploadedFile) {
    const cleanName = sanitizeFilename(uploadedFile.name);
    const resolvedMime = resolveAllowedMimeType(cleanName, uploadedFile.type);
    const bytes = Buffer.from(await uploadedFile.arrayBuffer());

    const fileErrors: FormFieldErrorMap = {};
    if (!cleanName || cleanName.length > 255) {
      addFieldError(fileErrors, 'file', 'Attachment filename is invalid or exceeds 255 characters');
    }
    if (bytes.byteLength <= 0) {
      addFieldError(fileErrors, 'file', 'Attached file cannot be empty');
    }
    if (bytes.byteLength > CONTACT_MAX_FILE_BYTES) {
      addFieldError(fileErrors, 'file', 'Attachment exceeds the 5 MiB limit');
    }
    if (!resolvedMime) {
      addFieldError(fileErrors, 'file', 'Unsupported attachment file type');
    }

    if (Object.keys(fileErrors).length > 0 || !resolvedMime) {
      return {
        status: 400,
        payload: {
          ok: false,
          source: 'server',
          formError: 'Server attachment validation failed.',
          fieldErrors: fileErrors,
        },
      };
    }

    attachment = {
      filename: cleanName,
      mimeType: resolvedMime,
      sizeBytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      contentBase64: bytes.toString('base64'),
    };
  }

  const parsed = ContactFormSubmissionSchema.safeParse({
    name: rawName,
    phone: rawPhone,
    email: rawEmail,
    message: rawMessage,
    attachment,
  });

  if (!parsed.success) {
    const fieldErrors: FormFieldErrorMap = {};
    for (const issue of parsed.error.issues) {
      const rootKey = String(issue.path[0] ?? 'form');
      const targetField = rootKey === 'attachment' ? 'file' : rootKey;
      addFieldError(fieldErrors, targetField, issue.message);
    }
    return {
      status: 400,
      payload: {
        ok: false,
        source: 'server',
        formError: 'Server schema validation failed. Review the fields below.',
        fieldErrors,
      },
    };
  }

  try {
    const submission = await insertContactSubmission(db, parsed.data);
    return {
      status: 201,
      payload: { ok: true, submission },
    };
  } catch (error) {
    if (error instanceof ContactDbConstraintError) {
      return {
        status: 422,
        payload: {
          ok: false,
          source: 'database',
          formError: error.message,
          fieldErrors: error.fieldErrors,
        },
      };
    }
    throw error;
  }
}
