import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
// Note: API key should be stored in environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure to add this to your .env.local file
});

export async function POST(request: NextRequest) {
  console.log("[MINDMAP API] Received request");
  
  try {
    // Check API key first
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    console.log("[MINDMAP API] OpenAI API Key present:", hasApiKey);
    
    if (!hasApiKey) {
      console.warn("[MINDMAP API] Missing OpenAI API key");
    }
    
    // Parse request body
    const body = await request.json();
    console.log("[MINDMAP API] Request body:", body);
    const { topic } = body;

    if (!topic) {
      console.error("[MINDMAP API] Missing topic in request");
      return NextResponse.json(
        { error: "Topic is required", debug: { requestBody: body } },
        { status: 400 }
      );
    }

    console.log(`[MINDMAP API] Generating mind map for topic: "${topic}"`); 

    // Generate mind map data using OpenAI
    const mindMapData = await generateMindMapWithOpenAI(topic);
    
    console.log("[MINDMAP API] Mind map generated successfully");
    
    return NextResponse.json({
      ...mindMapData,
      debug: {
        timestamp: new Date().toISOString(),
        topicProvided: topic,
        apiKeyPresent: hasApiKey,
      }
    });
  } catch (error: unknown) {
    console.error("Error generating mind map:", error);
    
    // Check if it's an OpenAI API error
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API error: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Handle any other type of error
    const errorMessage = error instanceof Error ? error.message : "Failed to generate mind map";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Generate mind map data using OpenAI's GPT-4o-mini
async function generateMindMapWithOpenAI(topic: string) {
  console.log("[MINDMAP GENERATOR] Starting mind map generation with OpenAI");
  
  // If OpenAI API key is not set, return a fallback response
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[MINDMAP GENERATOR] OPENAI_API_KEY is not set. Using fallback response.");
    return generateFallbackMindMap(topic);
  }
  
  // Log API key format (first and last few characters for debugging without exposing full key)
  const apiKey = process.env.OPENAI_API_KEY;
  const apiKeyFirstChars = apiKey.substring(0, 5);
  const apiKeyLastChars = apiKey.substring(apiKey.length - 4);
  console.log(`[MINDMAP GENERATOR] API Key format check: ${apiKeyFirstChars}...${apiKeyLastChars}`);

  try {
    console.log("[MINDMAP GENERATOR] Preparing prompt for OpenAI");
    
    const promptContent = `
    Create a comprehensive mind map for teaching the topic: "${topic}".
    
    This mind map will help students organize their thoughts for coherent writing and speaking.
    
    Your response must be valid JSON following this exact structure:
    {
      "topic": "Main Topic Name",
      "nodes": [
        {
          "id": "node_1",
          "text": "Main Category 1",
          "children": [
            {
              "id": "node_1_child_1",
              "text": "Specific Point 1.1"
            },
            {
              "id": "node_1_child_2",
              "text": "Specific Point 1.2"
            }
          ]
        },
        {
          "id": "node_2",
          "text": "Main Category 2",
          "children": [
            {
              "id": "node_2_child_1",
              "text": "Specific Point 2.1"
            }
          ]
        }
      ]
    }
    
    Ensure:
    1. The mind map has 4-6 main categories (nodes)
    2. Each main category has 2-4 specific points (children)
    3. All text is concise and educational
    4. Each node and child has a unique ID
    `;

    console.log("[MINDMAP GENERATOR] Making OpenAI API request with model: gpt-4o-mini");
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Using GPT-4o-mini as requested
        messages: [
          {
            role: "system",
            content: "You are an expert in education and knowledge organization. Generate structured mind maps that help with teaching, writing, and speaking coherently."
          },
          {
            role: "user",
            content: promptContent
          }
        ],
        response_format: { type: "json_object" }
      });
      
      console.log("[MINDMAP GENERATOR] Received response from OpenAI");

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      // Parse the response and validate it
      const parsedResponse = JSON.parse(content);
      
      // Ensure it has the correct structure
      if (!parsedResponse.topic || !Array.isArray(parsedResponse.nodes)) {
        throw new Error("Invalid response format from OpenAI");
      }
      
      console.log("[MINDMAP GENERATOR] Successfully parsed OpenAI response");
      return parsedResponse;
    } catch (openaiError) {
      console.error("[MINDMAP GENERATOR] Error in OpenAI request:", openaiError);
      throw openaiError;
    }
  } catch (error) {
    console.error("Error in OpenAI call:", error);
    // If OpenAI call fails, return a fallback response
    return generateFallbackMindMap(topic);
  }
}

// Fallback function for when OpenAI API is unavailable or has issues
function generateFallbackMindMap(topic: string) {
  // Generate unique IDs for nodes
  function generateId(prefix: string, index: number): string {
    return `${prefix}_${index}`;
  }
  
  // Default categories for a well-structured mind map
  const categories = [
    "Key Concepts",
    "Historical Context",
    "Applications",
    "Challenges & Limitations",
    "Future Directions"
  ];
  
  // Generate nodes from categories
  const nodes = categories.map((category, index) => {
    const id = generateId("node", index + 1);
    
    // Generate children for each category
    const children = [
      {
        id: `${id}_child_1`,
        text: `Important aspect of ${category.toLowerCase()}`
      },
      {
        id: `${id}_child_2`,
        text: `Critical element to understand`
      },
      {
        id: `${id}_child_3`,
        text: `Connection to broader themes`
      }
    ];
    
    return {
      id,
      text: category,
      children
    };
  });
  
  return {
    topic,
    nodes
  };
}
