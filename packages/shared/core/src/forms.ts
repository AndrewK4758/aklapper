import { z } from 'zod';

import type { ActionErrorMetadata } from './errors.ts';

export const CONTACT_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB

export const CONTACT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/json',
  'text/csv',
] as const;

export type ContactAllowedMimeType = (typeof CONTACT_ALLOWED_MIME_TYPES)[number];

export const CONTACT_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.json',
  '.csv',
] as const;

const CONTACT_EXTENSION_TO_MIMES: Readonly<Record<string, readonly ContactAllowedMimeType[]>> = {
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.json': ['application/json', 'text/plain'],
  '.csv': ['text/csv', 'text/plain'],
};

const NAME_SAFE_REGEX = /^[\p{L}\p{M}\p{N} .,'-]+$/u;
const PHONE_CHARS_REGEX = /^[0-9+(). -]+$/;

export function sanitizeFilename(rawName: string): string {
  const base = rawName.split(/[\\/]/).pop() ?? '';
  return Array.from(base)
    .filter(ch => {
      const code = ch.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .trim();
}

export function getFileExtension(filename: string): string {
  const clean = sanitizeFilename(filename);
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === clean.length - 1) return '';
  return clean.slice(dotIdx).toLowerCase();
}

export function resolveAllowedMimeType(
  filename: string,
  declaredMimeType: string,
): ContactAllowedMimeType | null {
  const normalizedMime = declaredMimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  const ext = getFileExtension(filename);
  const extMimes = ext ? CONTACT_EXTENSION_TO_MIMES[ext] : undefined;

  if (!extMimes) {
    return null;
  }

  if (
    normalizedMime &&
    (CONTACT_ALLOWED_MIME_TYPES as readonly string[]).includes(normalizedMime)
  ) {
    if (!extMimes.includes(normalizedMime as ContactAllowedMimeType)) {
      return null;
    }
    return normalizedMime as ContactAllowedMimeType;
  }

  if ((!normalizedMime || normalizedMime === 'application/octet-stream') && extMimes[0]) {
    return extMimes[0];
  }

  return null;
}

const BaseFieldNodeSchema = z.object({
  kind: z.literal('field'),
  id: z.string().min(1),
  name: z.string().min(1),
  label: z.string().min(1),
  cliFlag: z.string().min(2).optional(),
  description: z.string().optional(),
  required: z.boolean(),
});

export const TextFieldNodeSchema = BaseFieldNodeSchema.extend({
  fieldType: z.literal('text'),
  placeholder: z.string().optional(),
  autoComplete: z.string().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
});

export const TelFieldNodeSchema = BaseFieldNodeSchema.extend({
  fieldType: z.literal('tel'),
  placeholder: z.string().optional(),
  autoComplete: z.string().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
});

export const EmailFieldNodeSchema = BaseFieldNodeSchema.extend({
  fieldType: z.literal('email'),
  placeholder: z.string().optional(),
  autoComplete: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
});

export const TextareaFieldNodeSchema = BaseFieldNodeSchema.extend({
  fieldType: z.literal('textarea'),
  placeholder: z.string().optional(),
  rows: z.number().int().min(2).max(20).optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
});

export const FileFieldNodeSchema = BaseFieldNodeSchema.extend({
  fieldType: z.literal('file'),
  accept: z.array(z.string().min(1)).optional(),
  maxBytes: z.number().int().positive().optional(),
});

export const FormFieldNodeSchema = z.discriminatedUnion('fieldType', [
  TextFieldNodeSchema,
  TelFieldNodeSchema,
  EmailFieldNodeSchema,
  TextareaFieldNodeSchema,
  FileFieldNodeSchema,
]);

export type FormFieldNode = z.infer<typeof FormFieldNodeSchema>;

export interface FormFieldsetNode {
  kind: 'fieldset';
  id: string;
  legend: string;
  description?: string | undefined;
  columns?: 1 | 2 | undefined;
  children: FormNode[];
}

export type FormNode = FormFieldNode | FormFieldsetNode;

export const FormFieldsetNodeSchema: z.ZodType<FormFieldsetNode> = z.lazy(() =>
  z.object({
    kind: z.literal('fieldset'),
    id: z.string().min(1),
    legend: z.string().min(1),
    description: z.string().optional(),
    columns: z.union([z.literal(1), z.literal(2)]).optional(),
    children: z.array(FormNodeSchema).min(1),
  }),
);

export const FormNodeSchema: z.ZodType<FormNode> = z.lazy(() =>
  z.union([FormFieldNodeSchema, FormFieldsetNodeSchema]),
);

export const FormDefinitionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  cliCommand: z.string().min(1),
  submitLabel: z.string().min(1),
  resetLabel: z.string().min(1),
  nodes: z.array(FormNodeSchema).min(1),
});

export type FormDefinition = z.infer<typeof FormDefinitionSchema>;

export const ContactAttachmentSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, 'Attachment filename is required')
    .max(255, 'Attachment filename must be 255 characters or fewer')
    .refine(name => !name.includes('/') && !name.includes('\\') && !name.includes('..'), {
      message: 'Attachment filename contains disallowed path segments',
    }),
  mimeType: z.enum(CONTACT_ALLOWED_MIME_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive('Attachment cannot be empty')
    .max(CONTACT_MAX_FILE_BYTES, 'Attachment exceeds the 5 MiB limit'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid attachment SHA-256 digest'),
  contentBase64: z.string().min(1, 'Attachment payload is empty'),
});

export type ContactAttachment = z.infer<typeof ContactAttachmentSchema>;

export const ContactFormSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name must be 120 characters or fewer')
    .regex(NAME_SAFE_REGEX, 'Name contains unsupported characters'),
  phone: z
    .string()
    .trim()
    .transform(val => (val.length === 0 ? null : val))
    .nullable()
    .refine(
      val => {
        if (val === null) return true;
        if (val.length < 7 || val.length > 32) return false;
        if (!PHONE_CHARS_REGEX.test(val)) return false;
        const digitCount = val.replace(/\D/g, '').length;
        return digitCount >= 7 && digitCount <= 15;
      },
      { message: 'Enter a valid phone number (7–15 digits, optional +, (), -, spaces)' },
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Email must be 254 characters or fewer')
    .pipe(z.email('Enter a valid email address')),
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(4000, 'Message must be 4000 characters or fewer'),
  attachment: ContactAttachmentSchema.nullable(),
});

export type ContactFormSubmission = z.infer<typeof ContactFormSubmissionSchema>;

export interface FormFileLike {
  name: string;
  size: number;
  type: string;
}

export type FormFieldValues = Readonly<Record<string, string | FormFileLike | null | undefined>>;

export type FormFieldErrorMap = Record<string, string[]>;

export interface FormValidationOutcome {
  valid: boolean;
  fieldErrors: FormFieldErrorMap;
}

export function collectFormFields(nodes: readonly FormNode[]): FormFieldNode[] {
  const fields: FormFieldNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'field') {
      fields.push(node);
    } else {
      fields.push(...collectFormFields(node.children));
    }
  }
  return fields;
}

export function validateFormField(
  field: FormFieldNode,
  rawValue: string | FormFileLike | null | undefined,
): string[] {
  const errors: string[] = [];

  if (field.fieldType === 'file') {
    const file =
      rawValue && typeof rawValue === 'object' && 'name' in rawValue && rawValue.name.length > 0
        ? rawValue
        : null;

    if (!file) {
      if (field.required) {
        errors.push(`${field.label} is required`);
      }
      return errors;
    }

    const cleanName = sanitizeFilename(file.name);
    if (!cleanName || cleanName.length > 255) {
      errors.push('Attachment filename is invalid or exceeds 255 characters');
    }

    if (file.size <= 0) {
      errors.push('Attached file cannot be empty');
    }

    const maxBytes = field.maxBytes ?? CONTACT_MAX_FILE_BYTES;
    if (file.size > maxBytes) {
      const maxMb = (maxBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
      errors.push(`Attached file exceeds ${maxMb} MiB limit`);
    }

    const resolvedMime = resolveAllowedMimeType(cleanName, file.type);
    if (!resolvedMime) {
      errors.push(`Unsupported file type. Allowed: ${CONTACT_ALLOWED_EXTENSIONS.join(', ')}`);
    }
    return errors;
  }

  const textValue = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (textValue.length === 0) {
    if (field.required) {
      errors.push(`${field.label} is required`);
    }
    return errors;
  }

  if (field.fieldType === 'text') {
    if (field.minLength !== undefined && textValue.length < field.minLength) {
      errors.push(`${field.label} must be at least ${field.minLength} characters`);
    }
    if (field.maxLength !== undefined && textValue.length > field.maxLength) {
      errors.push(`${field.label} must be ${field.maxLength} characters or fewer`);
    }
    if (field.pattern) {
      const regex = new RegExp(field.pattern, 'u');
      if (!regex.test(textValue)) {
        errors.push(field.patternMessage ?? `${field.label} format is invalid`);
      }
    }
    if (!NAME_SAFE_REGEX.test(textValue) && field.name === 'name') {
      errors.push('Name contains unsupported characters');
    }
    return errors;
  }

  if (field.fieldType === 'tel') {
    if (field.minLength !== undefined && textValue.length < field.minLength) {
      errors.push(`${field.label} must be at least ${field.minLength} characters`);
    }
    if (field.maxLength !== undefined && textValue.length > field.maxLength) {
      errors.push(`${field.label} must be ${field.maxLength} characters or fewer`);
    }
    const digitCount = textValue.replace(/\D/g, '').length;
    if (!PHONE_CHARS_REGEX.test(textValue) || digitCount < 7 || digitCount > 15) {
      errors.push(
        field.patternMessage ??
          'Enter a valid phone number (7–15 digits, optional +, (), -, spaces)',
      );
    }
    return errors;
  }

  if (field.fieldType === 'email') {
    if (field.maxLength !== undefined && textValue.length > field.maxLength) {
      errors.push(`${field.label} must be ${field.maxLength} characters or fewer`);
    }
    const parsed = z.email().safeParse(textValue.toLowerCase());
    if (!parsed.success) {
      errors.push('Enter a valid email address');
    }
    return errors;
  }

  if (field.fieldType === 'textarea') {
    if (field.minLength !== undefined && textValue.length < field.minLength) {
      errors.push(`${field.label} must be at least ${field.minLength} characters`);
    }
    if (field.maxLength !== undefined && textValue.length > field.maxLength) {
      errors.push(`${field.label} must be ${field.maxLength} characters or fewer`);
    }
  }

  return errors;
}

export function validateFormValues(
  definition: FormDefinition,
  values: FormFieldValues,
): FormValidationOutcome {
  const fields = collectFormFields(definition.nodes);
  const fieldErrors: FormFieldErrorMap = {};

  for (const field of fields) {
    const errors = validateFormField(field, values[field.name]);
    if (errors.length > 0) {
      fieldErrors[field.name] = errors;
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export const CONTACT_FORM_DEFINITION: FormDefinition = FormDefinitionSchema.parse({
  id: 'contact-form',
  slug: 'contact',
  title: 'Direct Transmission // Contact',
  description:
    'Send a validated message stored directly in PostgreSQL 19. Required fields are marked [required]; Phone and File are optional.',
  cliCommand: 'contact',
  submitLabel: 'Transmit Message',
  resetLabel: 'Reset Buffer',
  nodes: [
    {
      kind: 'fieldset',
      id: 'sender-identity',
      legend: '01 // Sender Identity',
      description: 'Who is initiating this transmission?',
      columns: 2,
      children: [
        {
          kind: 'field',
          fieldType: 'text',
          id: 'contact-name',
          name: 'name',
          label: 'Name',
          cliFlag: '--name',
          description: 'Your full name or handle (2–120 chars).',
          placeholder: 'Ada Lovelace',
          autoComplete: 'name',
          required: true,
          minLength: 2,
          maxLength: 120,
        },
        {
          kind: 'field',
          fieldType: 'email',
          id: 'contact-email',
          name: 'email',
          label: 'Email',
          cliFlag: '--email',
          description: 'Reply address for direct follow-up.',
          placeholder: 'ada@analytical-engine.org',
          autoComplete: 'email',
          required: true,
          maxLength: 254,
        },
        {
          kind: 'fieldset',
          id: 'sender-direct-channel',
          legend: '01.1 // Optional Callback Channel',
          description: 'Leave blank if you prefer email-only responses.',
          columns: 1,
          children: [
            {
              kind: 'field',
              fieldType: 'tel',
              id: 'contact-phone',
              name: 'phone',
              label: 'Phone',
              cliFlag: '--phone',
              description: 'Optional direct phone number (7–15 digits).',
              placeholder: '+1 (555) 234-5678',
              autoComplete: 'tel',
              required: false,
              minLength: 7,
              maxLength: 32,
            },
          ],
        },
      ],
    },
    {
      kind: 'fieldset',
      id: 'transmission-payload',
      legend: '02 // Message & Attachment',
      description: 'Compose your note and optionally attach supporting specs or screenshots.',
      columns: 1,
      children: [
        {
          kind: 'field',
          fieldType: 'textarea',
          id: 'contact-message',
          name: 'message',
          label: 'Message',
          cliFlag: '--message',
          description: 'Project context, role details, or technical inquiry (10–4000 chars).',
          placeholder: 'Describe what you are building, timeline, or how we can collaborate...',
          rows: 5,
          required: true,
          minLength: 10,
          maxLength: 4000,
        },
        {
          kind: 'field',
          fieldType: 'file',
          id: 'contact-file',
          name: 'file',
          label: 'File',
          cliFlag: '--file',
          description: 'Optional attachment (PDF, TXT, MD, PNG, JPG, WEBP, JSON, CSV · max 5 MiB).',
          required: false,
          accept: [...CONTACT_ALLOWED_EXTENSIONS],
          maxBytes: CONTACT_MAX_FILE_BYTES,
        },
      ],
    },
  ],
});

export interface ContactSubmissionSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  attachmentName: string | null;
  attachmentSizeBytes: number | null;
  attachmentSha256: string | null;
  createdAt: string;
}

export type ContactActionResult =
  | {
      ok: true;
      submission: ContactSubmissionSummary;
    }
  | ({
      ok: false;
      source: 'client' | 'server' | 'database';
      formError: string;
      fieldErrors: FormFieldErrorMap;
    } & ActionErrorMetadata);

export interface FormFieldsetHeader {
  id: string;
  legend: string;
  description?: string | undefined;
  depth: number;
}

export interface FlattenedFormStep {
  field: FormFieldNode;
  index: number;
  total: number;
  enteredFieldsets: readonly FormFieldsetHeader[];
  fieldsetPath: readonly string[];
}

export function flattenFormSteps(definition: FormDefinition): FlattenedFormStep[] {
  const rawSteps: Array<{
    field: FormFieldNode;
    enteredFieldsets: FormFieldsetHeader[];
    fieldsetPath: string[];
  }> = [];
  const announcedFieldsetIds = new Set<string>();

  const walk = (nodes: readonly FormNode[], ancestors: readonly FormFieldsetHeader[]) => {
    for (const node of nodes) {
      if (node.kind === 'field') {
        const enteredFieldsets: FormFieldsetHeader[] = [];
        for (const ancestor of ancestors) {
          if (!announcedFieldsetIds.has(ancestor.id)) {
            announcedFieldsetIds.add(ancestor.id);
            enteredFieldsets.push(ancestor);
          }
        }
        rawSteps.push({
          field: node,
          enteredFieldsets,
          fieldsetPath: ancestors.map(a => a.legend),
        });
      } else {
        const header: FormFieldsetHeader = {
          id: node.id,
          legend: node.legend,
          description: node.description,
          depth: ancestors.length,
        };
        walk(node.children, [...ancestors, header]);
      }
    }
  };

  walk(definition.nodes, []);
  const total = rawSteps.length;
  return rawSteps.map((step, index) => ({
    ...step,
    index,
    total,
  }));
}

export function tokenizeCliCommand(raw: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let hasToken = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] ?? '';
    if (quote) {
      if (ch === '\\' && quote === '"' && i + 1 < raw.length) {
        current += raw[i + 1] ?? '';
        i++;
      } else if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      hasToken = true;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
      continue;
    }

    if (/\s/.test(ch)) {
      if (hasToken) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
      continue;
    }

    if (ch === '\\' && i + 1 < raw.length) {
      current += raw[i + 1] ?? '';
      i++;
      hasToken = true;
      continue;
    }

    current += ch;
    hasToken = true;
  }

  if (hasToken) {
    tokens.push(current);
  }
  return tokens;
}

export interface ParsedCliFormInvocation {
  help: boolean;
  openTui: boolean;
  providedFields: Record<string, string>;
  requestedFilePicker: boolean;
  unknownTokens: string[];
}

export function parseCliFormInvocation(
  definition: FormDefinition,
  rawCommand: string,
): ParsedCliFormInvocation {
  const tokens = tokenizeCliCommand(rawCommand);
  const argTokens = tokens.slice(1);
  const fields = collectFormFields(definition.nodes);

  const flagToField = new Map<string, FormFieldNode>();
  for (const field of fields) {
    const flag = (field.cliFlag ?? `--${field.name}`).toLowerCase();
    flagToField.set(flag, field);
    flagToField.set(`--${field.name.toLowerCase()}`, field);
  }

  let help = false;
  let openTui = false;
  let requestedFilePicker = false;
  const providedFields: Record<string, string> = {};
  const unknownTokens: string[] = [];

  for (let i = 0; i < argTokens.length; i++) {
    const token = argTokens[i] ?? '';
    if (token === '--help' || token === '-h') {
      help = true;
      continue;
    }
    if (token === '--tui') {
      openTui = true;
      continue;
    }

    const eqIdx = token.indexOf('=');
    const rawFlag = (eqIdx >= 0 ? token.slice(0, eqIdx) : token).toLowerCase();
    const matchedField = flagToField.get(rawFlag);

    if (!matchedField) {
      unknownTokens.push(token);
      continue;
    }

    let value: string | undefined;
    if (eqIdx >= 0) {
      value = token.slice(eqIdx + 1);
    } else if (i + 1 < argTokens.length && !(argTokens[i + 1] ?? '').startsWith('--')) {
      value = argTokens[i + 1] ?? '';
      i++;
    } else {
      value = '';
    }

    if (matchedField.fieldType === 'file') {
      requestedFilePicker = true;
    } else {
      providedFields[matchedField.name] = value;
    }
  }

  return {
    help,
    openTui,
    providedFields,
    requestedFilePicker,
    unknownTokens,
  };
}

export function formatCliFormHelp(definition: FormDefinition): string {
  const steps = flattenFormSteps(definition);
  const lines: string[] = [
    `${definition.title}`,
    `Usage: ${definition.cliCommand} [options]`,
    '',
    'Options (from recursive Zod/JSON schema):',
  ];

  for (const { field } of steps) {
    const flag = field.cliFlag ?? `--${field.name}`;
    const valueHint = field.fieldType === 'file' ? '' : ` <${field.name}>`;
    const reqTag = field.required ? '[required]' : '[optional]';
    const desc = field.description ?? field.label;
    lines.push(`  ${`${flag}${valueHint}`.padEnd(22)} ${reqTag} ${desc}`);
  }

  lines.push(
    `  ${'--tui'.padEnd(22)} Open the TUI form view (/contact)`,
    `  ${'-h, --help'.padEnd(22)} Show this usage summary`,
    '',
    'Interactive terminal mode:',
    `  Run "${definition.cliCommand}" with no flags (or partial flags) to fill fields inline.`,
    '  :back — previous field · Shift+Enter — newline in Message · Ctrl+C — cancel',
    '  At File step: type "attach" (or "a") to open file picker, or drag & drop onto pane.',
  );

  return lines.join('\n');
}
