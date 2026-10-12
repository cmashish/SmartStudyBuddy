import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {DocumentItem} from '../services/api';

export function DocumentCard({
  document,
  onDelete,
  deleting,
}: {
  document: DocumentItem;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>
          {document.filename.toLowerCase().endsWith('.pdf')
            ? 'PDF'
            : 'TXT'}
        </Text>
      </View>

      <View style={styles.content}>
        <Text
          numberOfLines={1}
          style={styles.filename}>
          {document.filename}
        </Text>

        <Text style={styles.meta}>
          {document.chunks} chunks • Ready
        </Text>
      </View>

      <Pressable
        onPress={onDelete}
        disabled={deleting}
        style={styles.deleteButton}>
        {deleting ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={styles.deleteText}>Delete</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginRight: 12,
  },
  iconText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338CA',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  filename: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  deleteText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
});
