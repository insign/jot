// jot/test/jules.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    listSources,
    createSession,
    createSessionWithImage,
    listActivities,
    approvePlan,
    deleteSession,
} from '../src/jules';

const FAKE_TOKEN = 'fake-token';

// Mock the global fetch function
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Jules API Helpers', () => {
    beforeEach(() => {
        fetchMock.mockClear();
    });

    const mockJsonResponse = (data: any, status = 200) => {
        return Promise.resolve(new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }));
    };

    const mockTextResponse = (data: string, status = 200) => {
        return Promise.resolve(new Response(data, { status }));
    };

    it('should throw an error on non-ok response', async () => {
        fetchMock.mockResolvedValue(mockTextResponse('Internal Server Error', 500));

        await expect(listSources(FAKE_TOKEN)).rejects.toThrow(
            'Jules API request failed: 500 Internal Server Error'
        );
    });

    it('listSources should return a list of sources', async () => {
        const sources = { sources: [{ name: 'source1' }] };
        fetchMock.mockResolvedValue(mockJsonResponse(sources));

        const result = await listSources(FAKE_TOKEN);
        expect(result).toEqual(sources);
        expect(fetchMock).toHaveBeenCalledWith(
            'https://jules.googleapis.com/v1alpha/sources',
            expect.any(Object)
        );
    });

    it('createSession should POST the correct body', async () => {
        const newSession = { name: 'sessions/new-id', prompt: 'test', source: 'test' };
        fetchMock.mockResolvedValue(mockJsonResponse(newSession));

        await createSession(FAKE_TOKEN, 'test', 'test');

        const fetchOptions = fetchMock.mock.calls[0][1];
        expect(fetchOptions.method).toBe('POST');
        expect(JSON.parse(fetchOptions.body)).toEqual({ prompt: 'test', source: 'test' });
    });

    it('createSessionWithImage should POST the correct media body', async () => {
        const newSession = { name: 'sessions/new-image-id', prompt: 'image' };
        fetchMock.mockResolvedValue(mockJsonResponse(newSession));

        await createSessionWithImage(FAKE_TOKEN, 'image', 'source', 'base64-data');

        const fetchOptions = fetchMock.mock.calls[0][1];
        expect(fetchOptions.method).toBe('POST');
        const body = JSON.parse(fetchOptions.body);
        expect(body.media.data).toBe('base64-data');
    });

    it('approvePlan should POST to the correct endpoint', async () => {
        fetchMock.mockResolvedValue(mockJsonResponse({ status: 'approved' }));
        const sessionId = 'session-abc';

        await approvePlan(FAKE_TOKEN, sessionId);

        expect(fetchMock).toHaveBeenCalledWith(
            `https://jules.googleapis.com/v1alpha/sessions/${sessionId}:approvePlan`,
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('deleteSession should use the DELETE method', async () => {
        // For DELETE, the helper returns response.text() which is an empty string for a 204
        fetchMock.mockResolvedValue(mockTextResponse('', 200));
        const sessionId = 'session-def';

        await deleteSession(FAKE_TOKEN, sessionId);

        expect(fetchMock).toHaveBeenCalledWith(
            `https://jules.googleapis.com/v1alpha/sessions/${sessionId}`,
            expect.objectContaining({ method: 'DELETE' })
        );
    });
});
