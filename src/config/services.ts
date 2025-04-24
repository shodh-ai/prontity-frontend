/**
 * Configuration for external services
 */

// WebRTC Token Service configuration
export const tokenServiceConfig = {
  // URL of the token service
  url: process.env.NEXT_PUBLIC_TOKEN_SERVICE_URL || 'http://localhost:3002',
  
  // API key for token service authentication
  apiKey: process.env.NEXT_PUBLIC_TOKEN_SERVICE_API_KEY || '',
  
  // Whether to include the API key in client-side requests
  // Only set to true if your token service is properly secured with CORS and authentication
  includeApiKeyInClient: process.env.NODE_ENV === 'development',
};

// Helper function to get the full token endpoint URL
export function getTokenEndpointUrl(room: string, username: string): string {
  return `${tokenServiceConfig.url}/api/token?room=${encodeURIComponent(room)}&username=${encodeURIComponent(username)}`;
}
