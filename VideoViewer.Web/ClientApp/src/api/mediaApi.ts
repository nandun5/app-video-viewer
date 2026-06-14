import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type { DirectoryContent, FileSystemItem } from '../store/mediaStore';

// Use relative URL for API base - works with any domain/port
const API_BASE = '/api';
const AUTH_TOKEN_KEY = 'VideoViewerAuthToken';
const AUTH_EXPIRY_KEY = 'VideoViewerAuthTokenExpiry';

type PinPromptHandler = (errorMessage?: string | null) => Promise<string>;

export type DirectoryOrFile = { type: 'directory'; data: DirectoryContent } | { type: 'file'; data: FileSystemItem };

let pinPromptHandler: PinPromptHandler | null = null;
let pinErrorMessage: string | null = null;
let authToken: string | null = null;
let authExpiry: number | null = null;
let authenticating: Promise<boolean> | null = null;

function toCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      result[camelKey] = toCamelCase(obj[key]);
    }
  }
  return result;
}

function encodePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function loadAuthState() {
  const storedToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
  const storedExpiry = sessionStorage.getItem(AUTH_EXPIRY_KEY);

  authToken = storedToken;
  authExpiry = storedExpiry ? Number(storedExpiry) : null;
}

function saveAuthState(token: string, expiresAt: number) {
  authToken = token;
  authExpiry = expiresAt;
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_EXPIRY_KEY, String(expiresAt));
  document.cookie = `VideoViewerAuthToken=${token}; path=/; max-age=${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}`;
}

function clearAuthState() {
  authToken = null;
  authExpiry = null;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_EXPIRY_KEY);
  document.cookie = 'VideoViewerAuthToken=; path=/; max-age=0';
}

function isTokenValid() {
  return authToken !== null && authExpiry !== null && Date.now() < authExpiry;
}

async function requestPinAndAuthenticate(): Promise<boolean> {
  if (!pinPromptHandler) {
    return false;
  }

  pinErrorMessage = null;

  while (true) {
    const pin = await pinPromptHandler(pinErrorMessage);
    pinErrorMessage = null;

    if (!pin || pin.length !== 6) {
      return false;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/auth/pin`,
        { pin },
        { withCredentials: true }
      );

      if (response.status === 200 && response.data?.token && response.data?.expiresAt) {
        const expiresAt = Date.parse(response.data.expiresAt);
        if (Number.isNaN(expiresAt)) {
          return false;
        }

        saveAuthState(response.data.token, expiresAt);
        return true;
      }

      if (response.status === 401) {
        clearAuthState();
        pinErrorMessage = 'Invalid PIN. Please try again.';
        continue;
      }

      return false;
    } catch (error) {
      clearAuthState();
      return false;
    }
  }
}

async function ensureAuthenticated(): Promise<boolean> {
  if (isTokenValid()) {
    return true;
  }

  if (authenticating) {
    return authenticating;
  }

  authenticating = requestPinAndAuthenticate();
  const result = await authenticating;
  authenticating = null;
  return result;
}

const api = axios.create({
  baseURL: API_BASE,
  validateStatus: () => true,
  withCredentials: true,
  transformResponse: [
    (data) => {
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return data;
        }
      }
      return toCamelCase(data);
    },
  ],
});

api.interceptors.request.use(async (config) => {
  const requestPath = config.url?.startsWith('http://') || config.url?.startsWith('https://')
    ? new URL(config.url).pathname
    : config.url?.startsWith('/')
      ? config.url.startsWith('/api')
        ? config.url
        : `${config.baseURL ?? ''}${config.url}`
      : `${config.baseURL ?? ''}/${config.url ?? ''}`.replace(/\/+/g, '/');

  if (requestPath.startsWith('/api') && !requestPath.startsWith('/api/auth')) {
    if (!isTokenValid()) {
      const authenticated = await ensureAuthenticated();
      if (!authenticated) {
        return config;
      }
    }

    if (authToken) {
      const existingHeaders = config.headers as Record<string, string> | undefined;
      config.headers = {
        ...existingHeaders,
        Authorization: `Bearer ${authToken}`,
      } as any;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError & { config?: AxiosRequestConfig & { _retry?: boolean } }) => {
    const status = error?.response?.status;
    const config = error?.config;

    if (status === 401 && config && !config._retry) {
      const requestPath = config.url?.startsWith('http://') || config.url?.startsWith('https://')
        ? new URL(config.url).pathname
        : config.url?.startsWith('/')
          ? config.url.startsWith('/api')
            ? config.url
            : `${config.baseURL ?? ''}${config.url}`
          : `${config.baseURL ?? ''}/${config.url ?? ''}`.replace(/\/+/g, '/');

      if (!requestPath.startsWith('/api/auth')) {
        clearAuthState();
        if (await ensureAuthenticated()) {
          config._retry = true;
          return api(config);
        }
      }
    }

    return Promise.reject(error);
  }
);

export const setPinPromptHandler = (handler: PinPromptHandler | null) => {
  pinPromptHandler = handler;
};

loadAuthState();

export const fileSystemApi = {
  getDirectory: async (path?: string): Promise<DirectoryOrFile | null> => {
    try {
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
    return `/api/thumbnails/${encodePath(path)}`;
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
