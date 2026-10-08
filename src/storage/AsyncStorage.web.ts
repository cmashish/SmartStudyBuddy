const storage = {
  async getItem(key: string): Promise<string | null> {
    return window.localStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    window.localStorage.clear();
  },

  async getAllKeys(): Promise<string[]> {
    return Object.keys(window.localStorage);
  },

  async multiGet(
    keys: string[],
  ): Promise<Array<[string, string | null]>> {
    return keys.map(key => [
      key,
      window.localStorage.getItem(key),
    ]);
  },

  async multiSet(
    entries: Array<[string, string]>,
  ): Promise<void> {
    entries.forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
  },

  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach(key => {
      window.localStorage.removeItem(key);
    });
  },
};

export default storage;