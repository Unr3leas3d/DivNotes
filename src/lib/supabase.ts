import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zqdaairthppjdioddatv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxZGFhaXJ0aHBwamRpb2RkYXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Nzg3NDYsImV4cCI6MjA4NzU1NDc0Nn0.xdXncyCwiiAh4I666oRauqh0q_t3tTTPV0GHWVQSJW4';

// Custom storage adapter using chrome.storage.local
// (Supabase's default localStorage doesn't work in Chrome extensions)
const chromeStorageAdapter = {
    getItem: (key: string): Promise<string | null> => {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] ?? null);
            });
        });
    },
    setItem: (key: string, value: string): Promise<void> => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    },
    removeItem: (key: string): Promise<void> => {
        return new Promise((resolve) => {
            chrome.storage.local.remove([key], resolve);
        });
    },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: chromeStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // No URL-based auth in extensions
        flowType: 'pkce',
    },
});
