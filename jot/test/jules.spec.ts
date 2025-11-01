// jot/test/jules.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { julesApiRequest, JulesApiError, createSessionWithImage } from '../src/jules';

const FAKE_TOKEN = 'fake-token';

const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Jules API Helpers', () => {
    beforeEach(() => {
        fetchMock.mockClear();
    });

    const mockJsonResponse = (data: any, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));

    const mockTextResponse = (data: string, status = 200) =>
        Promise.resolve(new Response(data, { status }));

    it('should throw JulesApiError on non-ok response', async () => {
        fetchMock.mockResolvedValue(mockTextResponse('Unauthorized', 401));
        await expect(julesApiRequest(FAKE_TOKEN, 'test')).rejects.toThrow(JulesApiError);
    });

    it('createSessionWithImage should POST correct body', async () => {
        const mockResponse = { name: 'sessions/new-session' };
        fetchMock.mockResolvedValue(mockJsonResponse(mockResponse));

        const result = await createSessionWithImage(FAKE_TOKEN, 'my prompt', 'my-source', 'my-imagedata');

        expect(fetchMock).toHaveBeenCalledOnce();
        const fetchOptions = fetchMock.mock.calls[0][1];
        const body = JSON.parse(fetchOptions.body);

        expect(body.prompt).toBe('my prompt');
        expect(body.media.mediaType).toBe('image/jpeg');
        expect(result).toEqual(mockResponse);
    });
});
