import type { IncomingMessage, ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

export async function writeMockOpenAiSseCompletion(
  req: IncomingMessage,
  res: ServerResponse,
  content: string,
  totalTokens: number,
  slowStream: boolean,
): Promise<void> {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    'x-accel-buffering': 'no',
  });

  let closed = false;
  req.once('close', () => {
    closed = true;
  });

  const words = content.split(/(\s+)/).filter(Boolean);
  const chunks: string[] = [];
  let buf = '';
  for (const word of words) {
    buf += word;
    if (buf.length >= 24) {
      chunks.push(buf);
      buf = '';
    }
  }
  if (buf) {
    chunks.push(buf);
  }

  for (const chunk of chunks) {
    if (closed || res.writableEnded) {
      return;
    }
    const frame = {
      id: 'chatcmpl-mock-sse',
      object: 'chat.completion.chunk',
      model: 'gemma-4',
      choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
    };
    res.write(`data: ${JSON.stringify(frame)}\n\n`);
    await delay(slowStream ? 450 : 12);
  }

  if (closed || res.writableEnded) {
    return;
  }

  const finalFrame = {
    id: 'chatcmpl-mock-sse',
    object: 'chat.completion.chunk',
    model: 'gemma-4',
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: Math.floor(totalTokens / 2),
      completion_tokens: totalTokens - Math.floor(totalTokens / 2),
      total_tokens: totalTokens,
    },
  };
  res.write(`data: ${JSON.stringify(finalFrame)}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

export async function handleMockChatCompletions(
  req: IncomingMessage,
  res: ServerResponse,
  body: Record<string, unknown>,
  writeJson: (res: ServerResponse, status: number, body: unknown) => void,
): Promise<void> {
  const messages = Array.isArray(body['messages']) ? body['messages'] : [];
  const joined = messages
    .map(msg =>
      msg && typeof msg === 'object'
        ? String((msg as Record<string, unknown>)['content'] ?? '')
        : '',
    )
    .join('\n');

  if (joined.toLowerCase().includes('delayed cold-start')) {
    await delay(4_500);
  }

  if (joined.includes('Rewrite the follow-up question')) {
    const followUpIdx = joined.lastIndexOf('Follow-up question:');
    const rawFollowUp =
      followUpIdx >= 0 ? joined.slice(followUpIdx + 'Follow-up question:'.length).trim() : '';
    const lowerFollowUp = rawFollowUp.toLowerCase();
    const isOffTopic =
      lowerFollowUp.includes('xylophone') ||
      lowerFollowUp.includes('underwater') ||
      lowerFollowUp.includes('flamingo') ||
      lowerFollowUp.includes('quantum soup') ||
      lowerFollowUp.includes('unrelated medical');
    writeJson(res, 200, {
      model: 'gemma-4',
      choices: [
        {
          message: {
            content: isOffTopic
              ? rawFollowUp
              : 'Andrew Klapper GCP Cloud Run and GKE Autopilot deployment architecture',
          },
        },
      ],
      usage: { total_tokens: 24 },
    });
    return;
  }

  if (joined.includes('conversational preamble acknowledging')) {
    if (joined.toLowerCase().includes('preamble error test')) {
      writeJson(res, 503, { error: { message: 'mock small llm unavailable' } });
      return;
    }
    const preambleText =
      "Checking Andrew Klapper's portfolio architecture records while retrieving verified sources.";
    if (body['stream'] === true) {
      await writeMockOpenAiSseCompletion(
        req,
        res,
        preambleText,
        24,
        joined.toLowerCase().includes('slow stream cancel'),
      );
      return;
    }
    writeJson(res, 200, {
      model: 'gemma-4',
      choices: [{ message: { content: preambleText } }],
      usage: { total_tokens: 24 },
    });
    return;
  }

  const isJdMatch = joined.includes('untrusted_job_description') || joined.includes('matchScore');
  const content = isJdMatch
    ? JSON.stringify({
        answer:
          'Strong grounded alignment across Andrew Klapper Go microservices, GKE Autopilot, TypeScript streaming React Router SSR, PostgreSQL 19, and Qdrant retrieval.',
        matchScore: 89,
        strengths: [
          'Production Cloud Run SSR paired with Go microservices on GKE Autopilot',
          'Atomic PostgreSQL 19 quota accounting and Qdrant semantic retrieval',
        ],
        gaps: ['No Terraform HCL modules indexed in public portfolio artifacts'],
      })
    : 'Andrew architected Cloud Run React Router 8 streaming SSR paired with Go microservices on GKE Autopilot backed by PostgreSQL 19 and Qdrant cosine vector retrieval.';

  if (body['stream'] === true) {
    await writeMockOpenAiSseCompletion(
      req,
      res,
      content,
      isJdMatch ? 320 : 240,
      joined.toLowerCase().includes('slow stream cancel'),
    );
    return;
  }

  writeJson(res, 200, {
    model: 'gemma-4',
    choices: [{ message: { content } }],
    usage: { total_tokens: isJdMatch ? 320 : 240 },
  });
}
