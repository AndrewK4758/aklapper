import {
  collectFormFields,
  type FormDefinition,
  type FormFieldErrorMap,
  type FormFieldNode,
  type FormFieldValues,
  type FormFileLike,
  type FormNode,
  validateFormField,
  validateFormValues,
} from '@aklapper/contracts';
import {
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  type SubmitEvent,
  useRef,
  useState,
} from 'react';

import { Button, Field, Fieldset, Input, Separator } from '../elements/base';

import styles from './RecursiveTuiForm.module.css';

export interface RecursiveTuiFormRenderProps {
  className: string;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

export interface RecursiveTuiFormProps {
  definition: FormDefinition;
  defaultValues?: Readonly<Record<string, string>>;
  serverErrors?: FormFieldErrorMap;
  serverFormError?: string | null;
  errorSource?: 'client' | 'server' | 'database' | null;
  isSubmitting?: boolean;
  onValidSubmit?: (values: FormFieldValues, event: SubmitEvent<HTMLFormElement>) => void;
  onReset?: () => void;
  renderForm?: (props: RecursiveTuiFormRenderProps) => JSX.Element;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function quoteCliArg(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  const truncated = compact.length > 42 ? `${compact.slice(0, 39)}...` : compact;
  return `"${truncated.replace(/"/g, '\\"')}"`;
}

function buildCliPreview(definition: FormDefinition, values: FormFieldValues): string {
  const fields = collectFormFields(definition.nodes);
  const parts: string[] = [`$ ${definition.cliCommand}`];

  for (const field of fields) {
    const flag = field.cliFlag ?? `--${field.name}`;
    const raw = values[field.name];
    if (field.fieldType === 'file') {
      if (raw && typeof raw === 'object' && 'name' in raw && raw.name.length > 0) {
        parts.push(`${flag} ${quoteCliArg(raw.name)}`);
      }
      continue;
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      parts.push(`${flag} ${quoteCliArg(raw)}`);
    }
  }

  return parts.join(' ');
}

interface FieldRenderContext {
  values: Readonly<Record<string, string | FormFileLike | null>>;
  errors: FormFieldErrorMap;
  onRegisterFileInput: (fieldName: string, el: HTMLInputElement | null) => void;
  onTextChange: (field: FormFieldNode, value: string) => void;
  onFileChange: (field: FormFieldNode, file: FormFileLike | null) => void;
  onFieldBlur: (field: FormFieldNode) => void;
  onClearFile: (field: FormFieldNode) => void;
  onControlKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

function RecursiveFormField({
  field,
  ctx,
}: {
  field: FormFieldNode;
  ctx: FieldRenderContext;
}): JSX.Element {
  const fieldErrors = ctx.errors[field.name] ?? [];
  const hasError = fieldErrors.length > 0;
  const descId = field.description ? `${field.id}-desc` : undefined;
  const errorId = hasError ? `${field.id}-error` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(' ') || undefined;

  const rawValue = ctx.values[field.name];
  const textValue = typeof rawValue === 'string' ? rawValue : '';
  const fileValue =
    rawValue && typeof rawValue === 'object' && 'name' in rawValue ? rawValue : null;

  return (
    <Field.Root name={field.name} invalid={hasError} className={styles.field}>
      <Field.Label htmlFor={field.id} className={styles.labelRow}>
        <span className={styles.labelMain}>
          <span>{field.label}</span>
          {field.cliFlag && <code className={styles.cliFlag}>{field.cliFlag}</code>}
        </span>
        <span className={field.required ? styles.badgeRequired : styles.badgeOptional}>
          {field.required ? '[required]' : '[optional]'}
        </span>
      </Field.Label>

      {field.fieldType === 'textarea' ? (
        <div className={styles.textareaShell} data-invalid={hasError ? 'true' : undefined}>
          <div className={styles.textareaBar}>
            <span aria-hidden='true'>❯ stdin</span>
            <span className={styles.charCounter}>
              {textValue.length}
              {field.maxLength !== undefined ? ` / ${field.maxLength}` : ''} chars
            </span>
          </div>
          <textarea
            id={field.id}
            name={field.name}
            rows={field.rows ?? 5}
            value={textValue}
            placeholder={field.placeholder}
            required={field.required}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              ctx.onTextChange(field, event.target.value)
            }
            onBlur={() => ctx.onFieldBlur(field)}
            onKeyDown={ctx.onControlKeyDown}
            className={styles.textarea}
          />
        </div>
      ) : field.fieldType === 'file' ? (
        <div className={styles.fileShell} data-invalid={hasError ? 'true' : undefined}>
          <input
            ref={el => ctx.onRegisterFileInput(field.name, el)}
            id={field.id}
            name={field.name}
            type='file'
            accept={field.accept?.join(',')}
            required={field.required}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const selected = event.target.files?.[0] ?? null;
              ctx.onFileChange(field, selected);
            }}
            onBlur={() => ctx.onFieldBlur(field)}
            className={styles.fileInput}
          />
          {fileValue && (
            <div className={styles.fileSelectedRow}>
              <span className={styles.fileMeta}>
                ▸ {fileValue.name} ({formatBytes(fileValue.size)})
              </span>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                onClick={() => ctx.onClearFile(field)}
                aria-label={`Clear ${field.label}`}
              >
                [clear]
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Input.Group className={styles.inputGroup} data-invalid={hasError ? 'true' : undefined}>
          <Input.Prefix className={styles.promptPrefix} aria-hidden='true'>
            ❯
          </Input.Prefix>
          <Input.Root
            id={field.id}
            name={field.name}
            type={field.fieldType}
            value={textValue}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            required={field.required}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              ctx.onTextChange(field, event.target.value)
            }
            onBlur={() => ctx.onFieldBlur(field)}
            onKeyDown={ctx.onControlKeyDown}
            className={styles.textInput}
          />
        </Input.Group>
      )}

      {field.description && (
        <p id={descId} className={styles.description}>
          {field.description}
        </p>
      )}

      {hasError && (
        <p id={errorId} role='alert' className={styles.errorText}>
          <span aria-hidden='true'>✖</span> {fieldErrors[0]}
        </p>
      )}
    </Field.Root>
  );
}

function RecursiveFormNode({
  node,
  depth,
  ctx,
}: {
  node: FormNode;
  depth: number;
  ctx: FieldRenderContext;
}): JSX.Element {
  if (node.kind === 'field') {
    return <RecursiveFormField field={node} ctx={ctx} />;
  }

  const columns = node.columns ?? 1;

  return (
    <Fieldset.Root className={styles.fieldset} data-depth={depth} data-columns={columns}>
      <Fieldset.Legend className={styles.legend}>
        <span className={styles.legendGlyph} aria-hidden='true'>
          {depth === 0 ? '┌─' : '├─'}
        </span>
        {node.legend}
      </Fieldset.Legend>
      {node.description && <p className={styles.fieldsetDesc}>{node.description}</p>}
      <div className={styles.nodeGrid} data-columns={columns}>
        {node.children.map(child => (
          <RecursiveFormNode key={child.id} node={child} depth={depth + 1} ctx={ctx} />
        ))}
      </div>
    </Fieldset.Root>
  );
}

function buildInitialValues(
  definition: FormDefinition,
  defaultValues?: Readonly<Record<string, string>>,
): Record<string, string | FormFileLike | null> {
  const initial: Record<string, string | FormFileLike | null> = {};
  for (const field of collectFormFields(definition.nodes)) {
    initial[field.name] = field.fieldType === 'file' ? null : (defaultValues?.[field.name] ?? '');
  }
  return initial;
}

export function RecursiveTuiForm({
  definition,
  defaultValues,
  serverErrors,
  serverFormError = null,
  errorSource = null,
  isSubmitting = false,
  onValidSubmit,
  onReset,
  renderForm,
}: RecursiveTuiFormProps): JSX.Element {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [values, setValues] = useState<Record<string, string | FormFileLike | null>>(() =>
    buildInitialValues(definition, defaultValues),
  );
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [clientErrors, setClientErrors] = useState<FormFieldErrorMap>({});
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [editedSinceServerError, setEditedSinceServerError] = useState<{
    ref: FormFieldErrorMap | undefined;
    fields: ReadonlySet<string>;
  }>({ ref: serverErrors, fields: new Set() });

  const activeEditedFields =
    editedSinceServerError.ref === serverErrors ? editedSinceServerError.fields : new Set<string>();

  const mergedErrors: FormFieldErrorMap = {};
  const allFields = collectFormFields(definition.nodes);
  for (const field of allFields) {
    const localErrs = clientErrors[field.name];
    const remoteErrs = activeEditedFields.has(field.name) ? undefined : serverErrors?.[field.name];
    if (localErrs && localErrs.length > 0) {
      mergedErrors[field.name] = localErrs;
    } else if (remoteErrs && remoteErrs.length > 0) {
      mergedErrors[field.name] = remoteErrs;
    }
  }

  const activeBannerError = clientFormError ?? serverFormError;
  const activeBannerSource = clientFormError ? 'client' : errorSource;

  function registerFileInput(fieldName: string, el: HTMLInputElement | null): void {
    fileInputRefs.current[fieldName] = el;
  }

  function markFieldEdited(fieldName: string): void {
    if (serverErrors?.[fieldName]) {
      setEditedSinceServerError(prev => {
        const next = new Set(prev.ref === serverErrors ? prev.fields : []);
        next.add(fieldName);
        return { ref: serverErrors, fields: next };
      });
    }
  }

  function updateFieldValidation(field: FormFieldNode, nextValue: string | FormFileLike | null) {
    const fieldErrs = validateFormField(field, nextValue);
    setClientErrors(prev => {
      const next = { ...prev };
      if (fieldErrs.length > 0) {
        next[field.name] = fieldErrs;
      } else {
        delete next[field.name];
      }
      return next;
    });
    if (fieldErrs.length === 0) {
      setClientFormError(null);
    }
  }

  function handleTextChange(field: FormFieldNode, nextValue: string): void {
    setValues(prev => ({ ...prev, [field.name]: nextValue }));
    markFieldEdited(field.name);
    if (touched.has(field.name) || clientErrors[field.name]) {
      updateFieldValidation(field, nextValue);
    }
  }

  function handleFileChange(field: FormFieldNode, nextFile: FormFileLike | null): void {
    setValues(prev => ({ ...prev, [field.name]: nextFile }));
    setTouched(prev => new Set(prev).add(field.name));
    markFieldEdited(field.name);
    updateFieldValidation(field, nextFile);
  }

  function handleClearFile(field: FormFieldNode): void {
    const inputEl = fileInputRefs.current[field.name];
    if (inputEl) {
      inputEl.value = '';
    }
    handleFileChange(field, null);
  }

  function handleFieldBlur(field: FormFieldNode): void {
    setTouched(prev => new Set(prev).add(field.name));
    updateFieldValidation(field, values[field.name] ?? null);
  }

  function handleControlKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.closest('form')?.requestSubmit();
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    const outcome = validateFormValues(definition, values);
    setTouched(new Set(allFields.map(field => field.name)));
    setClientErrors(outcome.fieldErrors);

    if (!outcome.valid) {
      event.preventDefault();
      const errorCount = Object.keys(outcome.fieldErrors).length;
      setClientFormError(
        `Client validation blocked transmission (${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} attention).`,
      );
      const firstInvalidField = allFields.find(field => outcome.fieldErrors[field.name]?.length);
      if (firstInvalidField) {
        document.getElementById(firstInvalidField.id)?.focus();
      }
      return;
    }

    setClientFormError(null);
    if (onValidSubmit) {
      onValidSubmit(values, event);
    }
  }

  function handleReset(): void {
    setValues(buildInitialValues(definition, defaultValues));
    setTouched(new Set());
    setClientErrors({});
    setClientFormError(null);
    setEditedSinceServerError({
      ref: serverErrors,
      fields: new Set(allFields.map(field => field.name)),
    });
    for (const inputEl of Object.values(fileInputRefs.current)) {
      if (inputEl) {
        inputEl.value = '';
      }
    }
    onReset?.();
  }

  const ctx: FieldRenderContext = {
    values,
    errors: mergedErrors,
    onRegisterFileInput: registerFileInput,
    onTextChange: handleTextChange,
    onFileChange: handleFileChange,
    onFieldBlur: handleFieldBlur,
    onClearFile: handleClearFile,
    onControlKeyDown: handleControlKeyDown,
  };

  const cliPreview = buildCliPreview(definition, values);

  const formContent = (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>{definition.title}</h1>
        <p className={styles.subtitle}>{definition.description}</p>
      </div>

      {activeBannerError && (
        <div role='alert' className={styles.bannerError}>
          <span className={styles.bannerSource}>[{activeBannerSource ?? 'error'}]</span>
          <span>{activeBannerError}</span>
        </div>
      )}

      {definition.nodes.map(node => (
        <RecursiveFormNode key={node.id} node={node} depth={0} ctx={ctx} />
      ))}

      <div className={styles.cliPreview} aria-live='polite'>
        <span className={styles.cliPreviewLabel}>CLI Command Preview</span>
        <code className={styles.cliPreviewCode}>{cliPreview}</code>
      </div>

      <Separator />

      <div className={styles.footer}>
        <span className={styles.shortcutHint}>
          Ctrl+Enter to transmit · client + server + pg19 CHECK validated
        </span>
        <div className={styles.actions}>
          <Button type='button' variant='default' disabled={isSubmitting} onClick={handleReset}>
            {definition.resetLabel}
          </Button>
          <Button type='submit' variant='primary' disabled={isSubmitting} loading={isSubmitting}>
            {isSubmitting ? 'Transmitting...' : definition.submitLabel}
          </Button>
        </div>
      </div>
    </>
  );

  if (renderForm) {
    return renderForm({
      className: styles.form,
      onSubmit: handleSubmit,
      children: formContent,
    });
  }

  return (
    <form
      method='post'
      encType='multipart/form-data'
      noValidate
      className={styles.form}
      onSubmit={handleSubmit}
    >
      {formContent}
    </form>
  );
}
