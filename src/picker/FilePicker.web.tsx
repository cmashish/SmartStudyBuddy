import type {PickedFile} from './types';

export async function pickStudyFile(): Promise<PickedFile | null> {
  return new Promise(resolve => {
    const input = document.createElement('input') as HTMLInputElement;

    input.type = 'file';
    input.accept = '.pdf,.txt,application/pdf,text/plain';

    input.onchange = () => {
      const file = input.files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      const name = file.name.toLowerCase();

      if (!name.endsWith('.pdf') && !name.endsWith('.txt')) {
        window.alert('Please select a PDF or TXT file.');
        resolve(null);
        return;
      }

      resolve({
        name: file.name,
        type:
          file.type ||
          (name.endsWith('.pdf')
            ? 'application/pdf'
            : 'text/plain'),
        file,
      });
    };

    input.click();
  });
}
