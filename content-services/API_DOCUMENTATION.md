# AI English Tutor Content Service API Documentation

## Service Overview

This microservice provides access to static learning content for the AI English Tutor platform, including:
- Vocabulary words
- Speaking topics
- Writing prompts

The service exposes RESTful endpoints that return JSON data, making it easy to integrate with any frontend framework.

## Content Service Role & Architecture

### What the Content Service Is About

Think of the Content Service as the digital library or textbook for your application. Its only job is to store and provide the actual learning materials:
- The list of vocabulary words, their definitions, and example sentences
- The topics or questions for speaking practice
- The prompts or essay questions for writing practice

It doesn't know anything about users, their progress, AI conversations, or drawings. It just holds the raw content and serves it up when asked via its API. It's primarily a read-only service from the perspective of the main user flow (content is usually added/updated separately, perhaps via admin tools or seeding scripts).

### How It Attaches to the Frontend

The Frontend connects to the Content Service using standard REST API calls (HTTP GET requests). Here's the typical flow:

1. **Navigation**: The user is navigated to a specific task page (e.g., VocabPage for the word "cacophony"). The Frontend knows the ID of the content needed (e.g., wordId = 'cacophony'). This ID usually comes from the URL parameters, which were likely set by a NAVIGATE_TO command from the Orchestration Service.

2. **API Call**: When the VocabPage component loads, it makes an API call to the Content Service's specific endpoint, including the ID. Example: `GET http://<content-service-url>/content/vocab/cacophony`.

3. **Response**: The Content Service looks up "cacophony" in its database and sends back the data (word, definition, example) as a JSON response.

4. **Display**: The Frontend receives the JSON data, updates its state, and displays the information in the appropriate UI elements (like the VocabBox component).

### Frontend Files Affected

The Content Service integration affects these frontend components:

1. **Page Components** (`src/pages/`):
   - `VocabPage.tsx`: Needs to fetch and display VocabWord data
   - `SpeakingPage.tsx`: Needs to fetch and display SpeakingTopic data
   - `WritingPage.tsx`: Needs to fetch and display WritingPrompt data
   
   These components will contain the logic to initiate the API call when they load.

2. **API Client Code** (`src/api/`):
   - Likely a file like `contentClient.ts` (or similar name) containing functions specifically designed to make the fetch or axios calls to the Content Service endpoints (`fetchVocabWord(wordId)`, `fetchSpeakingTopic(topicId)`, etc.)
   - The page components would import and use these functions

3. **State Management** (`src/state/` - Optional but likely):
   - You might have a Zustand slice (e.g., `currentTaskStore.ts`) or React Context to hold the content data fetched for the currently active task page
   - The page components would fetch the data and store it here, then read from the store to display it
   - This avoids re-fetching if the component re-renders

4. **Type Definitions** (`src/types/` or imported from shared-types):
   - Files defining the TypeScript interfaces (`VocabWord`, `SpeakingTopic`, `WritingPrompt`) so the Frontend knows the expected structure of the data received from the API calls

## Base URL

When running locally:
```
http://localhost:3001
```

## API Endpoints

### 1. Vocabulary Words

#### Get Vocabulary Word by ID

```
GET /content/vocab/:wordId
```

Retrieves details for a specific vocabulary word.

**URL Parameters:**
- `wordId` (string, required): The unique identifier of the vocabulary word

**Response Format:**
```typescript
{
  "wordId": string,
  "wordText": string,
  "definition": string,
  "exampleSentence": string | null,
  "difficultyLevel": number | null,
  "createdAt": string,
  "updatedAt": string
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved the vocabulary word
- `404 Not Found`: Vocabulary word with the given ID not found
- `500 Internal Server Error`: Server error

**Example Response:**
```json
{
  "wordId": "ubiquitous",
  "wordText": "ubiquitous",
  "definition": "Present, appearing, or found everywhere.",
  "exampleSentence": "Mobile phones are now ubiquitous in modern society.",
  "difficultyLevel": 4,
  "createdAt": "2025-04-24T12:41:22.153Z",
  "updatedAt": "2025-04-24T12:41:22.153Z"
}
```

### 2. Speaking Topics

#### Get Speaking Topic by ID

```
GET /content/speaking/topic/:topicId
```

Retrieves details for a specific speaking topic.

**URL Parameters:**
- `topicId` (string, required): The unique identifier of the speaking topic

**Response Format:**
```typescript
{
  "topicId": string,
  "title": string,
  "promptText": string,
  "difficultyLevel": number | null,
  "createdAt": string,
  "updatedAt": string
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved the speaking topic
- `404 Not Found`: Speaking topic with the given ID not found
- `500 Internal Server Error`: Server error

**Example Response:**
```json
{
  "topicId": "topic-climate-change",
  "title": "Climate Change",
  "promptText": "What do you think are the most important actions individuals and governments should take to address climate change? How might these challenges impact future generations?",
  "difficultyLevel": 4,
  "createdAt": "2025-04-24T12:41:22.153Z",
  "updatedAt": "2025-04-24T12:41:22.153Z"
}
```

### 3. Writing Prompts

#### Get Writing Prompt by ID

```
GET /content/writing/prompt/:promptId
```

Retrieves details for a specific writing prompt.

**URL Parameters:**
- `promptId` (string, required): The unique identifier of the writing prompt

**Response Format:**
```typescript
{
  "promptId": string,
  "title": string,
  "promptText": string,
  "difficultyLevel": number | null,
  "createdAt": string,
  "updatedAt": string
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved the writing prompt
- `404 Not Found`: Writing prompt with the given ID not found
- `500 Internal Server Error`: Server error

**Example Response:**
```json
{
  "promptId": "prompt-argumentative-1",
  "title": "Remote Work Debate",
  "promptText": "Do you think remote work should continue to be the norm after the pandemic? Write an argumentative essay supporting your position with clear reasons and examples.",
  "difficultyLevel": 4,
  "createdAt": "2025-04-24T12:41:22.153Z",
  "updatedAt": "2025-04-24T12:41:22.153Z"
}
```

## Sample Frontend Integration

### Using Fetch API (JavaScript/TypeScript)

```typescript
// Fetch a vocabulary word
async function fetchVocabWord(wordId: string) {
  try {
    const response = await fetch(`http://localhost:3001/content/vocab/${wordId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Vocabulary word not found');
      }
      throw new Error('Server error');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching vocabulary word:', error);
    throw error;
  }
}

// Example usage
fetchVocabWord('ubiquitous')
  .then(word => {
    console.log(word);
    // Update UI with word data
  })
  .catch(error => {
    // Handle error in UI
  });
```

### Using Axios (JavaScript/TypeScript)

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

// Create an API client
const contentApi = {
  // Fetch vocabulary word
  getVocabWord: async (wordId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content/vocab/${wordId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error('Vocabulary word not found');
      }
      throw error;
    }
  },
  
  // Fetch speaking topic
  getSpeakingTopic: async (topicId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content/speaking/topic/${topicId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error('Speaking topic not found');
      }
      throw error;
    }
  },
  
  // Fetch writing prompt
  getWritingPrompt: async (promptId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content/writing/prompt/${promptId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error('Writing prompt not found');
      }
      throw error;
    }
  }
};

// Example usage
async function loadContent() {
  try {
    const word = await contentApi.getVocabWord('ubiquitous');
    const topic = await contentApi.getSpeakingTopic('topic-climate-change');
    const prompt = await contentApi.getWritingPrompt('prompt-argumentative-1');
    
    // Update UI with the retrieved content
    console.log({ word, topic, prompt });
  } catch (error) {
    console.error('Error loading content:', error);
    // Display error message to user
  }
}
```

## Data Models

For TypeScript frontend applications, you can use these interfaces to type your API responses:

```typescript
interface VocabWord {
  wordId: string;
  wordText: string;
  definition: string;
  exampleSentence: string | null;
  difficultyLevel: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SpeakingTopic {
  topicId: string;
  title: string;
  promptText: string;
  difficultyLevel: number | null;
  createdAt: string;
  updatedAt: string;
}

interface WritingPrompt {
  promptId: string;
  title: string;
  promptText: string;
  difficultyLevel: number | null;
  createdAt: string;
  updatedAt: string;
}
```

**Note**: The date fields (`createdAt` and `updatedAt`) come from the API as strings in ISO format, not as `Date` objects.

## Available Content Items (Sample Data)

### Vocabulary Words
- `ubiquitous` - Difficulty: 4
- `ameliorate` - Difficulty: 5
- `ephemeral` - Difficulty: 4
- `serendipity` - Difficulty: 3

### Speaking Topics
- `topic-daily-routine` - Difficulty: 1
- `topic-climate-change` - Difficulty: 4
- `topic-technology` - Difficulty: 3

### Writing Prompts
- `prompt-narrative-story` - Difficulty: 2
- `prompt-argumentative-1` - Difficulty: 4
- `prompt-descriptive` - Difficulty: 2
