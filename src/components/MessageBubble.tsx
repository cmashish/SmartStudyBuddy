import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {ChatMessage} from '../types/chat';
import {colors} from '../theme/colors';

type Props = {
  message: ChatMessage;
};

export function MessageBubble({message}: Props) {
  const user = message.role === 'user';

  return (
    <View style={[styles.row, user ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, user ? styles.userBubble : styles.assistantBubble]}>
        <Text style={styles.role}>{user ? 'You' : 'Study Buddy'}</Text>
        <Text style={styles.content}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: 12,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: {
    backgroundColor: colors.userBubble,
  },
  assistantBubble: {
    backgroundColor: colors.assistantBubble,
  },
  role: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondaryText,
    marginBottom: 4,
  },
  content: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
});
