export interface ExportObjectStorage {
  putObject(input: {
    body: string;
    contentType: string;
    key: string;
  }): Promise<void>;
  getSignedDownloadUrl(input: {
    key: string;
    expiresInSeconds: number;
  }): Promise<string>;
}

export function createInMemoryExportObjectStorage(): ExportObjectStorage & {
  objects: Map<string, string>;
} {
  const objects = new Map<string, string>();

  return {
    objects,
    async getSignedDownloadUrl(input) {
      return `memory://${input.key}?expires=${input.expiresInSeconds}`;
    },
    async putObject(input) {
      objects.set(input.key, input.body);
    }
  };
}
