import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {DocumentCard} from '../components/DocumentCard';
import {
  deleteDocument,
  DocumentItem,
  getDocuments,
  uploadDocument,
} from '../services/api';
import {pickStudyFile} from '../picker/FilePicker';
import type {PickedFile} from '../picker/types';


export function StudyMaterialsScreen({
  onStartStudying,
}: {
  onStartStudying: () => void;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const loadDocuments = useCallback(async () => {
    try {
      const result = await getDocuments();
      setDocuments(result);
    } catch (error: any) {
      showError(error?.message ?? 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const showError = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Smart Study Buddy', message);
    }
  };

  const handlePickedFile = async (file: PickedFile | null) => {
    if (!file) {
      return;
    }

    setUploading(true);
    setStatus(`Uploading ${file.name}...`);

    try {
      const result = await uploadDocument(file);

      // Do not report success unless the backend confirms indexing.
      if (result.status !== 'ready' || result.chunks <= 0) {
        throw new Error(
          'The upload completed, but no text chunks were indexed. ' +
            'Check whether the PDF contains selectable text or needs OCR.',
        );
      }

      // Fetch the server's latest indexed-document list and update UI state.
      const latestDocuments = await getDocuments();
      setDocuments(latestDocuments);

      const listed = latestDocuments.some(
        document => document.document_id === result.document_id,
      );

      if (!listed) {
        setStatus(
          `${result.filename} was indexed, but the refreshed materials list ` +
            'did not include it. Check the backend /documents endpoint and RAG index path.',
        );
      } else {
        setStatus(
          `${result.filename} is ready — ${result.chunks} chunks indexed.`,
        );
      }
    } catch (error: any) {
      setStatus('Upload failed. Your materials list was not marked as updated.');
      showError(
        error?.message ?? 'Document upload failed.',
      );
      // Reload the server state even after failure; other existing materials
      // should remain visible if the upload itself failed.
      try {
        setDocuments(await getDocuments());
      } catch {
        // Preserve the original upload error shown above.
      }
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    try {
      const file = await pickStudyFile();
      await handlePickedFile(file);
    } catch (error: any) {
      showError(
        error?.message ?? 'Could not open the document picker.',
      );
    }
  };

  const handleDelete = async (documentId: string) => {
    const execute = async () => {
      setDeletingId(documentId);

      try {
        await deleteDocument(documentId);
        await loadDocuments();
      } catch (error: any) {
        showError(
          error?.message ?? 'Could not delete document.',
        );
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this study material?')) {
        await execute();
      }
    } else {
      Alert.alert(
        'Delete material',
        'Remove this document and its RAG chunks?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: execute,
          },
        ],
      );
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadDocuments}
        />
      }>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          AI STUDY ASSISTANT
        </Text>

        <Text style={styles.title}>
          Smart Study Buddy
        </Text>

        <Text style={styles.subtitle}>
          Upload your study material and ask questions
          using answers grounded in your documents.
        </Text>
      </View>

      <View style={styles.uploadCard}>
        <View style={styles.uploadIcon}>
          <Text style={styles.uploadIconText}>↑</Text>
        </View>

        <Text style={styles.uploadTitle}>
          Add study material
        </Text>

        <Text style={styles.uploadDescription}>
          Upload PDF or TXT files. They are converted
          into your local RAG knowledge base.
        </Text>

        <Pressable
          style={[
            styles.primaryButton,
            uploading && styles.disabledButton,
          ]}
          disabled={uploading}
          onPress={handleUpload}>
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              + Upload PDF / TXT
            </Text>
          )}
        </Pressable>

        {status ? (
          <Text style={styles.status}>{status}</Text>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            My Study Materials
          </Text>

          <Text style={styles.sectionSubtitle}>
            {documents.length} material
            {documents.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {loading && documents.length === 0 ? (
        <ActivityIndicator style={styles.loader} />
      ) : documents.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>
            No study material yet
          </Text>
          <Text style={styles.emptyText}>
            Upload your first PDF or TXT file to build
            your study knowledge base.
          </Text>
        </View>
      ) : (
        documents.map(document => (
          <DocumentCard
            key={document.document_id}
            document={document}
            deleting={
              deletingId === document.document_id
            }
            onDelete={() =>
              handleDelete(document.document_id)
            }
          />
        ))
      )}

      {documents.length > 0 && (
        <Pressable
          style={styles.studyButton}
          onPress={onStartStudying}>
          <Text style={styles.studyButtonText}>
            Start Studying →
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  container: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    marginTop: 10,
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#6366F1',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 26,
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  uploadIconText: {
    fontSize: 25,
    fontWeight: '800',
    color: '#4F46E5',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  uploadDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
  },
  primaryButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  status: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#4F46E5',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
  },
  loader: {
    marginTop: 30,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 420,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  studyButton: {
    marginTop: 20,
    minHeight: 50,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  studyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
