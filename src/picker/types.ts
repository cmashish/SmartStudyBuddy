export type PickedFile = {
  name: string;
  type: string;
  uri?: string;
  file?: unknown;
};

export type PickFile = () => Promise<PickedFile | null>;
