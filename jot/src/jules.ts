// src/jules.ts

const JULES_API_BASE_URL = 'https://jules.googleapis.com/v1alpha';

/**
 * A helper function to make authenticated requests to the Jules API.
 * @param token - The Jules API token.
 * @param endpoint - The API endpoint to call.
 * @param options - The options for the fetch request.
 * @returns The JSON response from the API.
 */
export const julesApiRequest = async (token: string, endpoint: string, options: RequestInit = {}) => {
	const url = `${JULES_API_BASE_URL}/${endpoint}`;
	const headers = {
		...options.headers,
		'Authorization': `Bearer ${token}`,
		'Content-Type': 'application/json',
	};

	const response = await fetch(url, { ...options, headers });

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Jules API request failed: ${response.status} ${errorText}`);
	}

	// For DELETE requests, we might not get a JSON body
	if (options.method === 'DELETE') {
		return response.text();
	}
	return response.json();
};

/**
 * Lists the available sources for the given Jules token.
 * @param token - The Jules API token.
 * @returns A list of sources.
 */
export const listSources = async (token: string) => {
	return julesApiRequest(token, 'sources');
};

/**
 * Creates a new Jules session.
 * @param token - The Jules API token.
 * @param prompt - The initial prompt for the session.
 * @param source - The source to use for the session.
 * @returns The newly created session object.
 */
export const createSession = async (token: string, prompt: string, source: string) => {
	const body = {
		prompt,
		source,
		// Add other session creation options as needed
	};
	return julesApiRequest(token, 'sessions', {
		method: 'POST',
		body: JSON.stringify(body),
	});
};

/**
 * Creates a new Jules session with an image.
 * @param token - The Jules API token.
 * @param prompt - The initial prompt for the session.
 * @param source - The source to use for the session.
 * @param imageData - The base64 encoded image data.
 * @returns The newly created session object.
 */
export const createSessionWithImage = async (token: string, prompt: string, source: string, imageData: string) => {
	const body = {
		prompt,
		source,
		media: {
			data: imageData,
			mediaType: 'image/jpeg', // Assuming jpeg, this could be improved
		},
	};
	return julesApiRequest(token, 'sessions', {
		method: 'POST',
		body: JSON.stringify(body),
	});
};

/**
 * Lists the activities for a given Jules session.
 * @param token - The Jules API token.
 * @param sessionId - The ID of the session to get activities for.
 * @returns A list of activities.
 */
export const listActivities = async (token: string, sessionId: string) => {
	return julesApiRequest(token, `sessions/${sessionId}/activities`);
};

/**
 * Approves the plan for a given Jules session.
 * @param token - The Jules API token.
 * @param sessionId - The ID of the session to approve the plan for.
 */
export const approvePlan = async (token: string, sessionId: string) => {
    return julesApiRequest(token, `sessions/${sessionId}:approvePlan`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
};

/**
 * Deletes a Jules session.
 * @param token - The Jules API token.
 * @param sessionId - The ID of the session to delete.
 */
export const deleteSession = async (token: string, sessionId: string) => {
    return julesApiRequest(token, `sessions/${sessionId}`, {
        method: 'DELETE',
    });
};
