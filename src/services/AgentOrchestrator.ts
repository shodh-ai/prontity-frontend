import { PageType } from '@/components/LiveKitSessionUI';

// Define agent types and their associated prompts
export interface AgentConfig {
  instructions: string;
  identity: string;
  voice?: string;
  temperature?: number;
}

// Map of page types to agent configurations
const agentConfigurations: Record<PageType, AgentConfig> = {
  'speaking': {
    identity: 'toefl-speaking-assistant',
    instructions: 'You are a TOEFL speaking practice assistant. Evaluate the student\'s response for clarity, coherence, pronunciation, and relevant content. Provide constructive feedback on their speaking performance and suggest improvements. Focus particularly on pronunciation, fluency, and organization of ideas.',
    voice: 'Echo',
    temperature: 0.7
  },
  'speakingpage': {
    identity: 'toefl-speaking-assistant',
    instructions: 'You are a TOEFL speaking practice assistant for this specific page. Evaluate the student\'s response for clarity, coherence, pronunciation, and relevant content. Provide constructive feedback on their speaking performance and suggest improvements. Focus particularly on pronunciation, fluency, and organization of ideas.',
    voice: 'Echo',
    temperature: 0.7
  },
  'writing': {
    identity: 'toefl-writing-assistant',
    instructions: 'You are a TOEFL writing practice assistant. Analyze the student\'s essay for organization, coherence, vocabulary usage, and grammar. Provide detailed feedback on their writing strengths and areas for improvement. Focus on essay structure, use of transitions, and development of ideas.',
    voice: 'Nova',
    temperature: 0.6
  },
  'vocab': {
    identity: 'toefl-vocabulary-coach',
    instructions: 'You are a TOEFL vocabulary coach. Help students learn and practice academic vocabulary commonly found in TOEFL exams. Explain word meanings, usage in context, and related words. Encourage the student to use new vocabulary in sentences.',
    voice: 'Onyx',
    temperature: 0.5
  },
  'reflection': {
    identity: 'toefl-reflection-guide',
    instructions: 'You are a TOEFL reflection guide. Help students reflect on their practice session by asking thoughtful questions about what they learned, areas they feel confident about, and where they want to improve. Provide encouragement and specific suggestions for continued improvement.',
    voice: 'Ember',
    temperature: 0.8
  },
  'rox': {
    identity: 'rox-ai-coach',
    instructions: 'You are Rox, a friendly and supportive TOEFL coach. Guide students through their TOEFL preparation journey. Answer their questions about the exam, suggest appropriate practice activities, and help them navigate between different practice sections. Be encouraging and motivational.',
    voice: 'Shimmer',
    temperature: 0.8
  },
  'login': {
    identity: 'system-assistant',
    instructions: 'You are a system assistant helping with login and authentication. Keep responses very brief and only related to account access.',
    voice: 'Onyx',
    temperature: 0.3
  },
  'default': {
    identity: 'ai-assistant',
    instructions: 'You are a helpful assistant for TOEFL practice.',
    voice: 'Echo',
    temperature: 0.7
  }
};

class AgentOrchestrator {
  private activeAgents: Map<string, { roomName: string, pageType: PageType }> = new Map();
  
  // Agent server URL
  private agentServerUrl = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'http://localhost:8080';
  
  /**
   * Start an agent for a specific room and page type
   */
  async startAgent(roomName: string, pageType: PageType): Promise<Response> {
    try {
      // Get the configuration for this page type
      const agentConfig = agentConfigurations[pageType] || agentConfigurations.default;
      
      // Check if an agent is already running for this room
      if (this.activeAgents.has(roomName)) {
        // If same page type, no need to restart
        if (this.activeAgents.get(roomName)?.pageType === pageType) {
          return new Response(JSON.stringify({
            status: 'already_running',
            message: `Agent already running for room ${roomName} with page type ${pageType}`
          }), { status: 200 });
        }
        
        // Different page type, stop the current agent before starting a new one
        await this.stopAgent(roomName);
      }
      
      // Start a new agent with the appropriate configuration using the agent server
      const response = await fetch(`${this.agentServerUrl}/connect-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room: roomName,
          identity: agentConfig.identity,
          instructions: agentConfig.instructions,
          voice: agentConfig.voice,
          temperature: agentConfig.temperature,
          pagePath: pageType
        }),
      });
      
      if (response.ok) {
        // Register this agent as active
        this.activeAgents.set(roomName, { roomName, pageType });
        
        return response;
      } else {
        throw new Error(`Failed to start agent: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error in AgentOrchestrator.startAgent:', error);
      return new Response(JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error starting agent'
      }), { status: 500 });
    }
  }
  
  /**
   * Stop an agent for a specific room
   */
  async stopAgent(roomName: string): Promise<Response> {
    try {
      // Only try to stop if we have a record of this agent
      if (!this.activeAgents.has(roomName)) {
        return new Response(JSON.stringify({
          status: 'not_running',
          message: `No agent running for room ${roomName}`
        }), { status: 200 });
      }
      
      // Call the agent server to stop the agent
      const response = await fetch(`${this.agentServerUrl}/disconnect-agent/${roomName}`, {
        method: 'POST',
      });
      
      // Remove from active agents regardless of response
      this.activeAgents.delete(roomName);
      
      return response;
    } catch (error) {
      console.error('Error in AgentOrchestrator.stopAgent:', error);
      return new Response(JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error stopping agent'
      }), { status: 500 });
    }
  }
  
  /**
   * Get the status of an agent for a specific room
   */
  async getAgentStatus(roomName: string): Promise<Response> {
    try {
      // Call the agent server to get status
      return await fetch(`${this.agentServerUrl}/agent-status/${roomName}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error in AgentOrchestrator.getAgentStatus:', error);
      return new Response(JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error getting agent status'
      }), { status: 500 });
    }
  }
  
  /**
   * Check if an agent is active for a room
   */
  isAgentActive(roomName: string): boolean {
    return this.activeAgents.has(roomName);
  }
  
  /**
   * Get all active agents
   */
  getActiveAgents(): { roomName: string, pageType: PageType }[] {
    return Array.from(this.activeAgents.values());
  }
}

// Export a singleton instance
export const agentOrchestrator = new AgentOrchestrator();

// Export configurations for use elsewhere
export { agentConfigurations };
