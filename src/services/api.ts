import {apiUrl} from '../config/api';

export type Source = {
  source?: string;
  page?: number | null;
  score?: number;
};

export type DocumentItem = {
  document_id: string;
  filename: string;
  chunks: number;
};

export type ChatResponse = {
  session_id: string;
  answer: string;
  sources: Source[];
};

async function parseResponse(response: Response) {
  const text = await response.text();

  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const detail =
      body?.detail ||
      text ||
      response.statusText ||
      'Unknown backend error';

    throw new Error(
      `Backend ${response.status}: ${detail}`,
    );
  }

  return body;
}

export async function getDocuments(): Promise<DocumentItem[]> {
  const response = await fetch(apiUrl('/documents'));
  const body = await parseResponse(response);
  return body?.documents ?? [];
}

export async function uploadDocument(
  file: {
    uri?: string;
    name: string;
    type: string;
    file?: unknown;
  },
): Promise<{
  document_id: string;
  filename: string;
  status: string;
  chunks: number;
  total_chunks: number;
}> {
  const form = new FormData();

  if (file.file) {
    form.append(
      'file',
      file.file as Blob,
    );
  } else {
    form.append(
      'file',
      {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any,
    );
  }

  const response = await fetch(
    apiUrl('/documents/upload'),
    {
      method: 'POST',
      body: form,
    },
  );

  return parseResponse(response);
}

export async function deleteDocument(
  documentId: string,
): Promise<void> {
  const response = await fetch(
    apiUrl(`/documents/${encodeURIComponent(documentId)}`),
    {
      method: 'DELETE',
    },
  );

  await parseResponse(response);
}

export async function sendMessage(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {
  const response = await fetch(
    apiUrl('/chat'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        message,
      }),
    },
  );

  return parseResponse(response);
}
