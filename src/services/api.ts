import {Platform} from 'react-native';
import type {ChatResponse} from '../types/chat';

export const API_BASE_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8000'
    : 'http://192.168.1.6:8000';

// For a physical Android device replace the Android URL with your PC LAN IP.
// Example: http://192.168.1.10:8000

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function sendMessage(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {

  const url = `${API_BASE_URL}/chat`;

  console.log('Calling backend:', url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        message,
      }),
    });

    const body = await response.text();

    console.log('Backend status:', response.status);
    console.log('Backend response:', body);

    if (!response.ok) {
      throw new Error(
        `Backend HTTP ${response.status}: ${body}`,
      );
    }

    return JSON.parse(body);
  } catch (error) {
    console.error('Backend connection error:', error);

    throw error;
  }
}

export async function getHistory(sessionId: string): Promise<unknown[]> {
  return request<unknown[]>(`/history/${encodeURIComponent(sessionId)}`);
}

export async function clearHistory(sessionId: string): Promise<void> {
  await request(`/history/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
}

export async function healthCheck(): Promise<{status: string}> {
  return request<{status: string}>('/health');
}
