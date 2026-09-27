// src/utils/mediaManager.ts

export interface MediaReference {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  sourceType: "local" | "remote";
  objectUrl?: string;
  status: "registering" | "ready" | "processing" | "error";
}

class ObjectURLManagerClass {
  private urls: Map<string, string> = new Map();

  public create(file: File): string {
    const url = URL.createObjectURL(file);
    this.urls.set(url, file.name);
    return url;
  }

  public revoke(url: string) {
    if (this.urls.has(url)) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
    }
  }

  public cleanup() {
    this.urls.forEach((_, url) => URL.revokeObjectURL(url));
    this.urls.clear();
  }
}

export const ObjectURLManager = new ObjectURLManagerClass();
