import { create } from 'zustand';

export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  mediaType?: string;
  size?: number;
  modified: string;
  links?: Record<string, string>;
}

export interface DirectoryContent {
  name: string;
  path: string;
  isDirectory: boolean;
  items: FileSystemItem[];
  links?: Record<string, string>;
}

interface MediaViewerStore {
  currentPath: string;
  rootName: string;
  currentDirectory: DirectoryContent | null;
  currentMediaItem: FileSystemItem | null;
  mediaItems: FileSystemItem[];
  currentMediaIndex: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentPath: (path: string) => void;
  setCurrentDirectory: (directory: DirectoryContent | null) => void;
  setRootName: (name: string) => void;
  setCurrentMediaItem: (item: FileSystemItem | null) => void;
  setMediaItems: (items: FileSystemItem[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  navigateToMedia: (index: number) => void;
  goToNextMedia: () => void;
  goToPreviousMedia: () => void;
}

export const useMediaViewerStore = create<MediaViewerStore>((set, get) => ({
  currentPath: '',
  rootName: '',
  currentDirectory: null,
  currentMediaItem: null,
  mediaItems: [],
  currentMediaIndex: -1,
  isLoading: false,
  error: null,

  setCurrentPath: (path: string) => set({ currentPath: path }),
  setCurrentDirectory: (directory: DirectoryContent | null) => {
    set({ currentDirectory: directory });
    if (directory) {
      // capture root directory name when first loaded (path === "")
      if (!get().rootName) {
        set({ rootName: directory.name });
      }
      const media = directory.items.filter(item => !item.isDirectory);
      set({ mediaItems: media, currentMediaIndex: -1 });
    }
  },
  setRootName: (name: string) => set({ rootName: name }),
  setCurrentMediaItem: (item: FileSystemItem | null) => set({ currentMediaItem: item }),
  setMediaItems: (items: FileSystemItem[]) => set({ mediaItems: items }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
  navigateToMedia: (index: number) => {
    const { mediaItems } = get();
    if (index >= 0 && index < mediaItems.length) {
      set({ currentMediaIndex: index, currentMediaItem: mediaItems[index] });
    }
  },
  goToNextMedia: () => {
    const { currentMediaIndex, mediaItems } = get();
    if (currentMediaIndex < mediaItems.length - 1) {
      set({ currentMediaIndex: currentMediaIndex + 1, currentMediaItem: mediaItems[currentMediaIndex + 1] });
    }
  },
  goToPreviousMedia: () => {
    const { currentMediaIndex, mediaItems } = get();
    if (currentMediaIndex > 0) {
      set({ currentMediaIndex: currentMediaIndex - 1, currentMediaItem: mediaItems[currentMediaIndex - 1] });
    }
  },
}));
