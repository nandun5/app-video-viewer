import axios from 'axios';
import { DirectoryContent, FileSystemItem } from '../store/mediaStore';

// Use relative URL for API base - works with any domain/port
const API_BASE = '/api';

/**
 * Convert PascalCase keys to camelCase (for .NET API responses)
 */
function toCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      result[camelKey] = toCamelCase(obj[key]);
    }
  }
  return result;
}

const api = axios.create({
  baseURL: API_BASE,
  validateStatus: () => true, // Don't throw on any status code
  transformResponse: [(data) => {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return data;
      }
    }
    return toCamelCase(data);
  }],
});

/**
 * Encode path for URL - converts backslashes to forward slashes and URL encodes
 */
function encodePath(path: string): string {
  // Normalize path separators to forward slashes
  const normalized = path.replace(/\\/g, '/');
  // Split by forward slash, encode each segment, and rejoin
  return normalized.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

export type DirectoryOrFile = { type: 'directory'; data: DirectoryContent } | { type: 'file'; data: FileSystemItem };

export const fileSystemApi = {
  getDirectory: async (path?: string): Promise<DirectoryOrFile | null> => {
    try {
      // Build URL based on whether path is provided
      const url = path ? `/filesystem/${encodePath(path)}` : '/filesystem';
      const response = await api.get(url);

      if (response.status === 200) {
        const data = response.data;
        if (data && data.isDirectory) {
          return { type: 'directory', data };
        }
        return { type: 'file', data };
      }

      throw new Error(`HTTP ${response.status}: ${response.data?.error || 'Unknown error'}`);
    } catch (error) {
      console.error('Error fetching directory:', error);
      throw error;
    }
  },

  getFile: async (path: string): Promise<FileSystemItem | null> => {
    try {
      const response = await api.get(`/filesystem/${encodePath(path)}`);

      if (response.status === 200) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('Error fetching file:', error);
      return null;
    }
  },
};

export const mediaApi = {
  getMediaUrl: (path: string): string => {
    return `/api/media/stream/${encodePath(path)}`;
  },

  getThumbnailUrl: (path: string): string => {
    return `/api/media/stream/${encodePath(path)}`;
  },

  getMediaInfo: async (path: string) => {
    try {
      const response = await api.head(`/media/stream/${encodePath(path)}`);

      return {
        contentLength: response.headers['content-length'],
        contentType: response.headers['content-type'],
        acceptRanges: response.headers['accept-ranges'],
      };
    } catch (error) {
      console.error('Error fetching media info:', error);
      return null;
    }
  },
};
