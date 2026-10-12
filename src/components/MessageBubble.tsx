import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {Source} from '../services/api';

export function MessageBubble({
  role,
  content,
  sources,
}: {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}) {
  const isUser = role === 'user';

  return (
    <View
      style={[
        styles.row,
        isUser ? styles.userRow : styles.assistantRow,
      ]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}>
        <Text
          style={[
            styles.text,
            isUser ? styles.userText : styles.assistantText,
          ]}>
          {content}
        </Text>

        {!isUser && sources && sources.length > 0 && (
          <View style={styles.sources}>
            <Text style={styles.sourcesTitle}>
              Sources
            </Text>

            {sources.map((source, index) => (
              <Text
                key={`${source.source}-${source.page}-${index}`}
                style={styles.source}>
                • {source.source ?? 'Study material'}
                {typeof source.page === 'number'
                  ? ` • Page ${source.page + 1}`
                  : ''}
              </Text>
            ))}
          </View>
        )}
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
    maxWidth: '86%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 5,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 5,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#1F2937',
  },
  sources: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sourcesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
  },
  source: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
});
