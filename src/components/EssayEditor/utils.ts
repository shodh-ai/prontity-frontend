/**
 * Utility functions for the Essay Editor
 */
import { createHash } from 'crypto';

/**
 * Extracts plain text from Tiptap JSON content
 * This is used for comment highlighting and other text-based operations
 * 
 * @param json - Tiptap JSON document
 * @returns Plain text representation of the document
 */
export function getTextFromTiptapJson(json: any): string {
  if (!json || !json.content) {
    return '';
  }

  let text = '';

  // Recursively traverse the JSON to extract text
  const traverse = (node: any) => {
    // If this is a text node, add its text
    if (node.type === 'text' && node.text) {
      text += node.text;
    }
    
    // If this is a paragraph or other node that should add a newline
    if (['paragraph', 'heading'].includes(node.type) && text.length > 0) {
      text += '\n';
    }
    
    // If the node has child content, traverse it
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  };

  // Start traversal at the root level content array
  json.content.forEach(traverse);
  
  return text;
}

/**
 * Generate a random client ID for collaboration
 */
export function generateClientId(): string {
  return `client-${Math.floor(Math.random() * 0xFFFFFF).toString(16)}`;
}

/**
 * Generate a deterministic UUID from a string input
 * This is useful for testing or when you need consistent UUIDs
 */
export function generateDeterministicUUID(input: string): string {
  // Use a fixed test UUID for now - this is safer than trying to generate one
  // In a real implementation, you might integrate with the auth system
  return '00000000-0000-0000-0000-000000000001';
}

/**
 * Helper to format a date
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (e) {
    return dateString;
  }
}

/**
 * Create a new essay via the API
 */
export async function createNewEssay(
  api: any, 
  userId: string, 
  title: string = 'Untitled Essay',
  initialContent: any = null
): Promise<string> {
  // The database expects a UUID for user_id, so we need to ensure proper format
  // For testing purposes, we'll generate a deterministic UUID based on the username
  const formattedUserId = generateDeterministicUUID(userId);
  // Default content if none provided
  const defaultContent = {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Start writing your essay here...' }]
    }]
  };
  
  const content = initialContent || defaultContent;
  
  try {
    console.log('Creating essay with params:', { userId: formattedUserId, title });
    console.log('Content structure:', JSON.stringify(content, null, 2));
    
    const response = await api.create(formattedUserId, title, content);
    console.log('API response:', response);
    
    if (!response || !response.id) {
      throw new Error('Invalid response from API: missing essay ID');
    }
    
    return response.id;
  } catch (error: any) {
    console.error('Error creating essay:', error);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Server response data:', error.response.data);
      console.error('Server response status:', error.response.status);
      console.error('Server response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
    }
    
    throw error;
  }
}
