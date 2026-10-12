import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {MessageBubble} from '../components/MessageBubble';
import {sendMessage, Source} from '../services/api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
};

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi! I’m ready to answer questions from your uploaded study material.',
};

export function ChatScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    INITIAL_MESSAGE,
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sessionId = useRef(
    `session-${Date.now()}`,
  ).current;

  const showError = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Smart Study Buddy', message);
    }
  };

  const handleSend = async () => {
    const question = input.trim();

    if (!question || sending) {
      return;
    }

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: question,
    };

    setMessages(previous => [
      ...previous,
      userMessage,
    ]);
    setInput('');
    setSending(true);

    try {
      const result = await sendMessage(
        sessionId,
        question,
      );

      setMessages(previous => [
        ...previous,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: result.answer,
          sources: result.sources,
        },
      ]);
    } catch (error: any) {
      showError(
        error?.message ??
          'Could not get an answer from the backend.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            Study Chat
          </Text>
          <Text style={styles.headerSubtitle}>
            Answers grounded in your materials
          </Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({item}) => (
          <MessageBubble
            role={item.role}
            content={item.content}
            sources={item.sources}
          />
        )}
        ListFooterComponent={
          sending ? (
            <View style={styles.typing}>
              <ActivityIndicator size="small" />
              <Text style={styles.typingText}>
                Thinking from your study material...
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.inputArea}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={10000}
          editable={!sending}
          onSubmitEditing={handleSend}
          style={styles.input}
        />

        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={[
            styles.sendButton,
            (!input.trim() || sending) &&
              styles.sendDisabled,
          ]}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 32,
    lineHeight: 32,
    color: '#111827',
  },
  headerContent: {
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },
  messages: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 20,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  sendButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
