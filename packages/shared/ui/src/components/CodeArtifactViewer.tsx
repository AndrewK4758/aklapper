import { useState } from 'react';

import { cx } from '../elements/_internal/elementFactory';
import { Button } from '../elements/base/Button';
import { StatusPill } from '../elements/StatusPill';
import {
  computeUtf8ByteLength,
  type SyntaxTokenKind,
  tokenizeMarkupLine,
} from './codeSyntaxTokens';

import styles from './CodeArtifactViewer.module.css';

export interface CodeArtifactViewerProps {
  readonly code: string;
  readonly fileName?: string;
  readonly copyLabel?: string;
  readonly copiedLabel?: string;
  readonly downloadLabel?: string;
  readonly emptyLabel?: string;
  readonly className?: string;
}

const TOKEN_CLASS_MAP: Readonly<Record<SyntaxTokenKind, string | undefined>> = {
  plain: undefined,
  tag: styles.tokTag,
  attr: styles.tokAttr,
  string: styles.tokString,
  comment: styles.tokComment,
  punct: styles.tokPunct,
};

export function CodeArtifactViewer({
  code,
  fileName = 'cadence-artifact.html',
  copyLabel = 'Copy HTML',
  copiedLabel = 'Copied',
  downloadLabel = 'Download HTML',
  emptyLabel = 'No artifact source available yet.',
  className,
}: CodeArtifactViewerProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [copyErrorMsg, setCopyErrorMsg] = useState<string | null>(null);

  const byteCount = computeUtf8ByteLength(code);
  const lines = code.length > 0 ? code.split('\n') : [];

  const handleCopy = () => {
    if (!code) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('error');
      setCopyErrorMsg('Clipboard API unavailable in this browser context.');
      return;
    }
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopyState('copied');
        setCopyErrorMsg(null);
      })
      .catch(() => {
        setCopyState('error');
        setCopyErrorMsg('Unable to copy source to clipboard.');
      });
  };

  const handleDownload = () => {
    if (
      !code ||
      typeof document === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      return;
    }
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div className={cx(styles.viewer, className)} data-testid='code-artifact-viewer'>
      <div className={styles.toolbar}>
        <div className={styles.meta}>
          <StatusPill tone='neutral' size='sm'>
            {fileName}
          </StatusPill>
          <StatusPill tone='info' size='sm' data-testid='code-artifact-bytes'>
            {byteCount} bytes
          </StatusPill>
          <StatusPill tone='neutral' size='sm'>
            {lines.length} lines
          </StatusPill>
        </div>
        <div className={styles.actions}>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            onClick={handleCopy}
            disabled={!code}
            data-testid='cadence-copy-html'
          >
            <Button.Label>{copyState === 'copied' ? copiedLabel : copyLabel}</Button.Label>
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            onClick={handleDownload}
            disabled={!code}
            data-testid='cadence-download-html'
          >
            <Button.Label>{downloadLabel}</Button.Label>
          </Button>
        </div>
      </div>

      {copyState === 'error' && copyErrorMsg ? (
        <p className={styles.copyError} role='alert' data-testid='code-artifact-copy-error'>
          {copyErrorMsg}
        </p>
      ) : null}

      {lines.length > 0 ? (
        <div className={styles.codeScroll}>
          <pre className={styles.pre} data-testid='cadence-source-code'>
            <code>
              {lines.map((line, lineIndex) => {
                const tokens = tokenizeMarkupLine(line);
                return (
                  <span key={lineIndex} className={styles.line}>
                    <span className={styles.lineNum} aria-hidden='true'>
                      {lineIndex + 1}
                    </span>
                    <span className={styles.lineContent}>
                      {tokens.length > 0
                        ? tokens.map((token, tokenIndex) => {
                            const cls = TOKEN_CLASS_MAP[token.kind];
                            return cls ? (
                              <span key={tokenIndex} className={cls}>
                                {token.text}
                              </span>
                            ) : (
                              token.text
                            );
                          })
                        : ' '}
                    </span>
                  </span>
                );
              })}
            </code>
          </pre>
        </div>
      ) : (
        <p className={styles.empty}>{emptyLabel}</p>
      )}
    </div>
  );
}
