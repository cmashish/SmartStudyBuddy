import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ChatInput} from '../components/ChatInput';
import {MessageBubble} from '../components/MessageBubble';
import {clearHistory, sendMessage} from '../services/api';
import {clearMessages, loadMessages, saveMessages} from '../storage/chatStorage';
import {colors} from '../theme/colors';
import type {ChatMessage} from '../types/chat';

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createSessionId(): string {
  return `session-${Date.now()}`;
}

export function ChatScreen() {
  const [sessionId, setSessionId] = useState(createSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages().then(setMessages);
  }, []);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const welcome = useMemo<ChatMessage>(
    () => ({
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi! I am Smart Study Buddy. Ask me a question about your uploaded study material.',
      createdAt: new Date().toISOString(),
    }),
    [],
  );

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([welcome]);
    }
  }, [messages.length, welcome]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };

    setInput('');
    setMessages(current => [...current, userMessage]);
    setLoading(true);

    try {
      const response = await sendMessage(sessionId, question);

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: response.answer,
        createdAt: new Date().toISOString(),
      };

      setMessages(current => [...current, assistantMessage]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to reach the backend.';

      setMessages(current => [
        ...current,
        {
          id: createId(),
          role: 'assistant',
          content: `I could not answer that because the backend request failed.\n\n${message}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleNewChat() {
    setSessionId(createSessionId());
    setMessages([welcome]);
    setInput('');
  }

  async function handleClear() {
    try {
      await clearHistory(sessionId);
    } catch {
      // The local UI can still be cleared if the backend session is unavailable.
    }

    await clearMessages();
    setMessages([welcome]);
    setSessionId(createSessionId());

    Alert.alert('Chat cleared', 'Your local chat history has been cleared.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Smart Study Buddy</Text>
            <Text style={styles.subtitle}>RAG-powered learning assistant</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={handleNewChat} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>New Chat</Text>
            </Pressable>
            <Pressable onPress={handleClear} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Clear</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({item}) => <MessageBubble message={item} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.secondaryText,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    padding: 16,
    paddingBottom: 20,
  },
});
