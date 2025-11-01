// src/utils.ts

/**
 * Extracts GitHub links from a session's outputs.
 * @param outputs - The outputs object from a Jules session.
 * @returns A formatted string with clickable Markdown links for any found GitHub URLs.
 */
export const extractGitHubLinks = (outputs: any): string => {
    if (!outputs) {
        return '';
    }

    let links = '';
    const urlRegex = /https?:\/\/[^\s,)]+/g;

    for (const key in outputs) {
        if (typeof outputs[key] === 'string') {
            const matches = outputs[key].match(urlRegex);
            if (matches) {
                matches.forEach(url => {
                    if (url.includes('github.com')) {
                        if (url.includes('/pull/')) {
                            links += `🔀 [Pull Request](${url})\n`;
                        } else if (url.includes('/tree/')) {
                            links += `🌿 [Branch](${url})\n`;
                        } else if (url.includes('/commit/')) {
                            links += `📝 [Commit](${url})\n`;
                        } else {
                            links += `🔗 [GitHub Link](${url})\n`;
                        }
                    }
                });
            }
        }
    }

    return links;
};
