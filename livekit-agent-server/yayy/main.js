// LiveKit Agent implementation in Node.js
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Room, RoomEvent, LocalParticipant, RemoteParticipant, 
        TrackSource, DataPacket_Kind, ConnectionState } = require('livekit-client');
const { AccessToken } = require('livekit-server-sdk');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { program } = require('commander');

// Load environment variables
dotenv.config();

// Configure logging
const logger = {
  info: (...args) => console.log(new Date().toISOString(), 'INFO:', ...args),
  warn: (...args) => console.log(new Date().toISOString(), 'WARN:', ...args),
  error: (...args) => console.log(new Date().toISOString(), 'ERROR:', ...args),
  debug: (...args) => process.env.DEBUG && console.log(new Date().toISOString(), 'DEBUG:', ...args)
};

// LiveKit configuration
const liveKitUrl = process.env.LIVEKIT_URL;
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

// Google API configuration
const googleApiKey = process.env.GOOGLE_API_KEY;

// Verify environment variables
function verifyEnvironment() {
  const requiredVars = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'GOOGLE_API_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
  
  logger.info(`Using LiveKit URL: ${liveKitUrl}`);
}

// Assistant class implementation
class Assistant {
  constructor() {
    this.instructions = "You are an English teacher that will help with pronunciation and grammar.";
    this.googleAI = new GoogleGenerativeAI(googleApiKey);
    this.model = null;
    this.room = null;
    this.audioQueue = [];
    this.isProcessing = false;
    this.isConnected = false;
  }

  async initialize() {
    try {
      // Initialize Google Generative Model
      const genAI = this.googleAI;
      this.model = genAI.getGenerativeModel({ 
        model: "gemini-pro",
        generationConfig: {
          temperature: 0.8,
          topP: 1,
          topK: 32,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      logger.info("AI model initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize AI model:", error);
      throw error;
    }
  }

  async connect(roomName, participantIdentity = 'ai-assistant') {
    // Create a token for the agent
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: 'AI Assistant',
    });

    at.addGrant({ 
      roomJoin: true, 
      room: roomName,
      canPublish: true, 
      canSubscribe: true
    });

    const token = at.toJwt();
    
    // Create a new room instance
    this.room = new Room({
      adaptiveStream: false,
      dynacast: true,
      audioOutput: { deviceId: 'default' },
    });

    // Connect to the room
    logger.info(`Connecting to room: ${roomName} as ${participantIdentity}`);
    
    try {
      await this.room.connect(liveKitUrl, token);
      logger.info('Connected to LiveKit room');
      this.isConnected = true;
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Send a greeting to the room
      await this.sendMessage("Hello! I'm your AI English teacher assistant. How can I help you today?");
      
      return true;
    } catch (error) {
      logger.error('Failed to connect to LiveKit room:', error);
      return false;
    }
  }

  setupEventListeners() {
    if (!this.room) return;

    this.room.on(RoomEvent.ParticipantConnected, participant => {
      logger.info(`Participant connected: ${participant.identity}`);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, participant => {
      logger.info(`Participant disconnected: ${participant.identity}`);
    });

    // Listen for data messages
    this.room.on(RoomEvent.DataReceived, (data, participant) => {
      try {
        const decoder = new TextDecoder();
        const message = decoder.decode(data);
        logger.info(`Received message from ${participant?.identity}: ${message}`);
        
        // Process the message
        this.processUserMessage(message, participant);
      } catch (error) {
        logger.error('Error processing data message:', error);
      }
    });

    // Listen for audio tracks
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.source === TrackSource.Microphone) {
        logger.info(`Subscribed to ${participant.identity}'s microphone track`);
        
        // Here we would process audio, but that's complex in Node.js without proper bindings
        // In a full implementation, we'd use something like node-webrtc or a cloud speech API
        logger.info(`Audio processing would happen here in a full implementation`);
      }
    });
    
    // Handle disconnection
    this.room.on(RoomEvent.Disconnected, () => {
      logger.info('Disconnected from room');
      this.isConnected = false;
    });
  }

  async processUserMessage(message, participant) {
    try {
      if (!this.model) {
        logger.error('AI model not initialized');
        return;
      }

      let userMessage = message;
      // Try to parse as JSON if applicable
      try {
        const parsed = JSON.parse(message);
        if (parsed.content) {
          userMessage = parsed.content;
        }
      } catch (e) {
        // Not JSON, use the raw message
      }

      logger.info(`Processing message: ${userMessage}`);
      
      // Generate a response using the Google AI model
      const result = await this.model.generateContent([
        { text: `${this.instructions}\n\nUser message: ${userMessage}\n\nProvide a helpful response:` }
      ]);
      
      const response = result.response;
      const responseText = response.text();
      
      // Send the response back to the room
      await this.sendMessage(responseText);
      
    } catch (error) {
      logger.error('Error processing user message:', error);
      await this.sendMessage("I'm sorry, I encountered an error processing your message. Could you please try again?");
    }
  }

  async sendMessage(text) {
    if (!this.room || !this.isConnected) {
      logger.error('Cannot send message: not connected to a room');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      await this.room.localParticipant.publishData(data, DataPacket_Kind.RELIABLE);
      logger.info(`Sent message: ${text}`);
    } catch (error) {
      logger.error('Error sending message:', error);
    }
  }

  async disconnect() {
    if (this.room) {
      await this.sendMessage("Goodbye! I'm disconnecting now.");
      this.room.disconnect();
      logger.info('Disconnected from room');
    }
  }
}

// Main function
async function main() {
  // Parse command-line arguments
  program
    .name('livekit-agent')
    .description('LiveKit AI Agent CLI')
    .version('1.0.0');
  
  program
    .command('connect')
    .description('Connect to a LiveKit room')
    .requiredOption('--room <name>', 'room name to connect to')
    .option('--participant-identity <identity>', 'identity to use in the room', 'ai-assistant')
    .action(async (options) => {
      try {
        // Verify environment
        verifyEnvironment();
        
        // Create a new assistant
        const assistant = new Assistant();
        await assistant.initialize();
        
        // Connect to the room
        const success = await assistant.connect(options.room, options.participantIdentity);
        if (!success) {
          logger.error('Failed to connect to room');
          process.exit(1);
        }
        
        // Handle termination signals
        process.on('SIGINT', async () => {
          logger.info('Received SIGINT, shutting down...');
          await assistant.disconnect();
          process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
          logger.info('Received SIGTERM, shutting down...');
          await assistant.disconnect();
          process.exit(0);
        });
        
        logger.info(`Connected to room ${options.room} as ${options.participantIdentity}`);
      } catch (error) {
        logger.error('Error in connect command:', error);
        process.exit(1);
      }
    });
  
  // Parse arguments
  await program.parseAsync();
  
  // If no command is provided, show help
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

// Run the app
main().catch(err => {
  logger.error('Unhandled error:', err);
  process.exit(1);
});
