import type { AskResponse, AskSource, AskTurnState, PortalAskContent } from '@aklapper/core';
import {
  Button,
  CitationSourceList,
  Input,
  PaneLink,
  StreamingTextFeed,
  SuggestionChipRow,
} from '@aklapper/ui';
import type { FormEvent } from 'react';

import {
  AskJdResultCard,
  AskPendingCard,
  AskQaTranscriptCard,
  AskStarterRow,
} from './AskResultCard';
import type { ActiveAskStreamState } from './askStreamClient';
import type { QaTranscriptEntry } from './askTurnRecovery';

import styles from './PortalAskPage.module.css';

export interface AskQaPanelProps {
  readonly content: PortalAskContent;
  readonly activeLensId?: string;
  readonly visibleStarters: readonly string[];
  readonly questionText: string;
  readonly isBusy: boolean;
  readonly isStreaming: boolean;
  readonly activeStream: ActiveAskStreamState | null;
  readonly failedStreamSources?: readonly AskSource[];
  readonly visiblePendingTurnState: AskTurnState | null;
  readonly pendingSubmittedText?: string;
  readonly qaTranscript: readonly QaTranscriptEntry[];
  readonly onSelectLens: (lensId: string) => void;
  readonly onSelectStarter: (starter: string) => void;
  readonly onChangeQuestion: (value: string) => void;
  readonly onSubmitQa: (event: FormEvent<HTMLFormElement>) => void;
  readonly onCancelStream: () => void;
  readonly onNewConversation: () => void;
  readonly onSelectFollowUp: (followUp: string) => void;
}

export function AskQaPanel({
  content,
  activeLensId,
  visibleStarters,
  questionText,
  isBusy,
  isStreaming,
  activeStream,
  failedStreamSources,
  visiblePendingTurnState,
  pendingSubmittedText,
  qaTranscript,
  onSelectLens,
  onSelectStarter,
  onChangeQuestion,
  onSubmitQa,
  onCancelStream,
  onNewConversation,
  onSelectFollowUp,
}: AskQaPanelProps) {
  return (
    <>
      {content.visitorLenses.length > 0 ? (
        <div className={styles.lensBar}>
          <SuggestionChipRow
            ariaLabel='Visitor lenses'
            selectedId={activeLensId}
            disabled={isBusy}
            testIdPrefix='ask-lens'
            items={content.visitorLenses.map(lens => ({
              id: lens.id,
              label: lens.label,
              description: lens.description,
            }))}
            onSelect={item => onSelectLens(item.id)}
          />
          {qaTranscript.length > 0 || isStreaming ? (
            <Button
              type='button'
              variant='ghost'
              size='xs'
              onClick={onNewConversation}
              data-testid='ask-new-conversation'
            >
              <Button.Label>{content.newConversationLabel}</Button.Label>
            </Button>
          ) : null}
        </div>
      ) : null}

      <AskStarterRow questions={visibleStarters} disabled={isBusy} onSelect={onSelectStarter} />

      <form className={styles.form} onSubmit={onSubmitQa}>
        <Input.Group className={styles.inputGroup}>
          <Input.Prefix aria-hidden='true'>?</Input.Prefix>
          <Input.Root
            type='text'
            name='question'
            maxLength={800}
            value={questionText}
            onChange={event => onChangeQuestion(event.currentTarget.value)}
            placeholder={content.questionPlaceholder}
            aria-label={content.questionAriaLabel}
            data-testid='ask-question-input'
          />
        </Input.Group>
        <div className={styles.actions}>
          {isStreaming ? (
            <Button
              type='button'
              variant='ghost'
              onClick={onCancelStream}
              data-testid='ask-stream-cancel'
            >
              <Button.Label>Cancel</Button.Label>
            </Button>
          ) : null}
          <Button
            type='submit'
            variant='primary'
            disabled={isBusy || questionText.trim().length < 4}
            data-testid='ask-qa-submit'
          >
            <Button.Label>{isBusy ? content.streamingQaLabel : content.submitQaLabel}</Button.Label>
          </Button>
        </div>
      </form>

      {activeStream ? (
        <div className={styles.streamContainer} data-testid='ask-streaming-feed'>
          <div className={styles.preambleBox}>
            <strong className={styles.entryQuestion}>Q: {activeStream.question}</strong>
            {activeStream.isPreambleLoading ? (
              <output className={styles.preambleLoading} data-testid='ask-preamble-loading'>
                {activeStream.statusLabel}
              </output>
            ) : null}
            {activeStream.preambleText.length > 0 ? (
              <p className={styles.preambleText} data-testid='ask-preamble-feed' aria-live='polite'>
                {activeStream.preambleText}
              </p>
            ) : null}
            {activeStream.preambleError ? (
              <output className={styles.preambleError} data-testid='ask-preamble-error'>
                <p className={styles.preambleErrorText}>{activeStream.preambleError.message}</p>
                {activeStream.preambleError.action ? (
                  <p className={styles.metaLine}>{activeStream.preambleError.action}</p>
                ) : null}
              </output>
            ) : null}
          </div>
          <CitationSourceList heading='Live Retrieved Sources' sources={activeStream.sources} />
          {activeStream.sourcesReceived || activeStream.text.length > 0 ? (
            <StreamingTextFeed
              content={activeStream.text}
              isStreaming={true}
              statusLabel={activeStream.statusLabel}
              emptyText={activeStream.statusLabel}
            />
          ) : null}
        </div>
      ) : failedStreamSources && failedStreamSources.length > 0 ? (
        <div className={styles.streamContainer} data-testid='ask-failed-sources'>
          <CitationSourceList heading='Live Retrieved Sources' sources={failedStreamSources} />
        </div>
      ) : null}

      {visiblePendingTurnState && pendingSubmittedText ? (
        <AskPendingCard turnState={visiblePendingTurnState} submittedText={pendingSubmittedText} />
      ) : null}

      {qaTranscript.length > 0 ? (
        <ol className={styles.transcript} data-testid='ask-qa-transcript'>
          {qaTranscript.map(entry => (
            <AskQaTranscriptCard
              key={entry.id}
              question={entry.question}
              response={entry.response}
              content={content}
              isBusy={isBusy}
              onSelectFollowUp={onSelectFollowUp}
            />
          ))}
        </ol>
      ) : !activeStream && !visiblePendingTurnState ? (
        <div className={styles.emptyThread} data-testid='ask-empty-hint'>
          <p className={styles.notice}>{content.emptyThreadHint}</p>
          <PaneLink to={content.contactCtaHref} className={styles.ctaLink}>
            {content.contactCtaLabel}
          </PaneLink>
        </div>
      ) : null}
    </>
  );
}

export interface AskJdPanelProps {
  readonly content: PortalAskContent;
  readonly jdText: string;
  readonly isBusy: boolean;
  readonly visiblePendingTurnState: AskTurnState | null;
  readonly pendingSubmittedText?: string;
  readonly latestJdResult: AskResponse | null;
  readonly onChangeJd: (value: string) => void;
  readonly onSubmitJd: (event: FormEvent<HTMLFormElement>) => void;
}

export function AskJdPanel({
  content,
  jdText,
  isBusy,
  visiblePendingTurnState,
  pendingSubmittedText,
  latestJdResult,
  onChangeJd,
  onSubmitJd,
}: AskJdPanelProps) {
  return (
    <>
      <form className={styles.form} onSubmit={onSubmitJd}>
        <label className={styles.textareaLabel} htmlFor='jd-match-textarea'>
          {content.jdTextareaLabel}
        </label>
        <textarea
          id='jd-match-textarea'
          name='jobDescription'
          className={styles.textarea}
          rows={6}
          maxLength={8000}
          value={jdText}
          onChange={event => onChangeJd(event.currentTarget.value)}
          placeholder={content.jdPlaceholder}
          data-testid='ask-jd-textarea'
        />
        <div className={styles.actions}>
          <Button
            type='submit'
            variant='primary'
            disabled={isBusy || jdText.trim().length < 20}
            data-testid='ask-jd-submit'
          >
            <Button.Label>
              {isBusy ? content.evaluatingJdLabel : content.submitJdLabel}
            </Button.Label>
          </Button>
        </div>
      </form>

      {visiblePendingTurnState && pendingSubmittedText ? (
        <AskPendingCard turnState={visiblePendingTurnState} submittedText={pendingSubmittedText} />
      ) : null}

      {latestJdResult ? <AskJdResultCard response={latestJdResult} content={content} /> : null}
    </>
  );
}
