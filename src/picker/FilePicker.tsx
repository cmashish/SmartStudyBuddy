import {pick, types} from '@react-native-documents/picker';
import type {PickedFile} from './types';

export async function pickStudyFile(): Promise<PickedFile | null> {
  try {
    const [result] = await pick({
      type: [types.pdf, types.plainText],
      allowMultiSelection: false,
      mode: 'import',
    });

    if (!result) {
      return null;
    }

    const name = result.name ?? 'study-material';
    const lower = name.toLowerCase();

    if (!lower.endsWith('.pdf') && !lower.endsWith('.txt')) {
      throw new Error('Please select a PDF or TXT file.');
    }

    return {
      name,
      type:
        result.type ??
        (lower.endsWith('.pdf')
          ? 'application/pdf'
          : 'text/plain'),
      uri: result.uri,
    };
  } catch (error: any) {
    const message = String(error?.message ?? error);

    if (
      message.toLowerCase().includes('cancel') ||
      error?.code === 'OPERATION_CANCELED'
    ) {
      return null;
    }

    throw error;
  }
}
