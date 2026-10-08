import AsyncStorage from '../storage/AsyncStorage';
import type {ChatMessage} from '../types/chat';

const KEY = 'smart-study-buddy-chat';

export async function loadMessages(): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function saveMessages(messages: ChatMessage[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(messages));
}

export async function clearMessages(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
