// src/jules.ts

const JULES_API_BASE_URL = 'https://jules.googleapis.com/v1alpha';

export class JulesApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'JulesApiError';
    }
}

export const julesApiRequest = async (token: string, endpoint: string, options: RequestInit = {}) => {
    const url = `${JULES_API_BASE_URL}/${endpoint}`;
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        const errorText = await response.text();
        throw new JulesApiError(`Jules API request failed: ${response.status} ${errorText}`, response.status);
    }

    if (response.status === 204 || options.method === 'DELETE') {
        return response.text();
    }
    return response.json();
};

// All other functions are just wrappers around julesApiRequest
export const listSources = (token: string) => julesApiRequest(token, 'sources');
export const createSession = (token: string, prompt: string, source: string) => julesApiRequest(token, 'sessions', { method: 'POST', body: JSON.stringify({ prompt, source }) });
export const createSessionWithImage = (token: string, prompt: string, source: string, imageData: string) => {
    const body = { prompt, source, media: { data: imageData, mediaType: 'image/jpeg' } };
    return julesApiRequest(token, 'sessions', { method: 'POST', body: JSON.stringify(body) });
};
export const continueSession = (token: string, sessionId: string, prompt: string) => julesApiRequest(token, `sessions/${sessionId}:sendMessage`, { method: 'POST', body: JSON.stringify({ prompt }) });
export const listActivities = (token: string, sessionId: string) => julesApiRequest(token, `sessions/${sessionId}/activities`);
export const approvePlan = (token: string, sessionId: string) => julesApiRequest(token, `sessions/${sessionId}:approvePlan`, { method: 'POST', body: '{}' });
export const deleteSession = (token: string, sessionId: string) => julesApiRequest(token, `sessions/${sessionId}`, { method: 'DELETE' });
export const publishBranch = (token: string, sessionId: string) => julesApiRequest(token, `sessions/${sessionId}:publishBranch`, { method: 'POST', body: '{}' });
export const publishPr = (token: string, sessionId: string) => julesApiRequest(token, `sessions/${sessionId}:createPullRequest`, { method: 'POST', body: '{}' });
