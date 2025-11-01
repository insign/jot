// src/cache.ts

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, { value: any; timestamp: number }>();

export const getFromCache = (key: string): any | null => {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.value;
    }
    // Entry is expired or doesn't exist
    cache.delete(key);
    return null;
};

export const setInCache = (key: string, value: any): void => {
    cache.set(key, { value, timestamp: Date.now() });
};
