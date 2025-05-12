import { PRONITY_API_URL, PronityApiError } from './pronityClient';

/**
 * Test the connection to the Pronity backend
 * @param token JWT token for authentication
 * @returns Promise resolving to true if connection is successful
 */
export async function testBackendConnection(token: string): Promise<boolean> {
  try {
    // You can use a simple health check endpoint or any existing endpoint that's lightweight
    const response = await fetch(`${PRONITY_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      console.log('Backend connection successful:', await response.text());
      return true;
    } else {
      console.error('Backend connection failed with status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error connecting to backend:', error);
    return false;
  }
}

/**
 * Test the full transcription and audio upload flow with minimal test data
 * @param token JWT token for authentication
 */
export async function testTranscriptionApi(token: string): Promise<void> {
  try {
    console.log('Testing transcription API...');
    
    // Step 1: Save a minimal test transcription
    const testData = {
      userId: 'test-user',
      transcription: 'This is a test transcription',
      duration: 5,
      practiceDate: new Date().toISOString()
    };
    
    const saveEndpoint = `${PRONITY_API_URL}/speaking/save-transcription`;
    console.log(`Making request to: ${saveEndpoint}`);
    
    const saveResponse = await fetch(saveEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testData)
    });
    
    if (!saveResponse.ok) {
      throw new Error(`Failed to save transcription: ${saveResponse.status} ${saveResponse.statusText}`);
    }
    
    const savedData = await saveResponse.json();
    console.log('Transcription saved successfully:', savedData);
    
    // Step 2: Test the audio upload with a tiny audio blob
    if (savedData.id) {
      // Create a small test audio blob
      const testAudioBlob = new Blob(['test audio data'], { type: 'audio/webm' });
      
      const uploadEndpoint = `${PRONITY_API_URL}/speaking/upload-audio`;
      console.log(`Making request to: ${uploadEndpoint}`);
      
      const formData = new FormData();
      formData.append('audio', testAudioBlob, 'test_recording.webm');
      formData.append('practiceId', savedData.id);
      
      const uploadResponse = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload audio: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      console.log('Audio upload successful:', await uploadResponse.json());
    }
    
    console.log('API test completed successfully');
  } catch (error) {
    console.error('API test failed:', error);
    throw error;
  }
}
