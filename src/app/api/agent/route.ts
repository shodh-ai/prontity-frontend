import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

// Convert exec to promise-based for easier async usage
const execAsync = promisify(exec);

// Store active agent sessions
const activeSessions: Record<string, { 
  status: string,
  pid?: number,
  startTime?: number,
  error?: string
}> = {};

// Debug logger
const logError = (message: string, error: any) => {
  console.error(`❌ ERROR: ${message}`);
  console.error('Details:', error);
  if (error instanceof Error) {
    console.error('Stack:', error.stack);
  }
  if (error?.stderr) {
    console.error('StdErr:', error.stderr);
  }
};

export async function GET(req: NextRequest) {
  const roomName = req.nextUrl.searchParams.get('room');
  
  if (!roomName) {
    return NextResponse.json({ error: 'Missing room parameter' }, { status: 400 });
  }
  
  // Return the status of the agent in the specified room
  if (activeSessions[roomName]) {
    return NextResponse.json({ 
      status: activeSessions[roomName].status,
      startTime: activeSessions[roomName].startTime
    });
  } else {
    return NextResponse.json({ status: 'not_connected' });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room, identity, instructions } = body;
    
    if (!room) {
      return NextResponse.json({ error: 'Missing room parameter' }, { status: 400 });
    }
    
    // If agent is already connected to this room
    if (activeSessions[room] && activeSessions[room].status === 'connected') {
      return NextResponse.json({ 
        status: 'already_connected',
        message: 'Agent is already connected to this room' 
      });
    }
    
    // Update status to 'connecting'
    activeSessions[room] = { 
      status: 'connecting',
      startTime: Date.now()
    };
    
    // Path to the agent Python script in the livekit-agent-server/toefl directory
    const scriptPath = path.join(process.cwd(), '..', 'livekit-agent-server', 'toefl', 'main_fixed.py');
    
    // Start the agent process in background
    try {
      console.log(`Starting agent for room ${room}...`);
      // Use the path to our working full_implementation directory
      const agentPath = path.join(process.cwd(), '..', 'livekit-agent-server', 'full_implementation');
      console.log(`Agent path: ${agentPath}`);
      
      // Use a non-blocking approach to start the agent
      // This way the API can return immediately and the agent runs in the background
      // Activate the virtual environment in main directory and run our working implementation
      const mainVenvPath = path.join(process.cwd(), '..', 'livekit-agent-server', 'main');
      const command = `cd "${agentPath}" && source "${mainVenvPath}/bin/activate" && python3 "${agentPath}/main.py" connect --room "${room}" --participant-identity "${identity || 'ai-assistant'}"`;  
      console.log(`Executing command: ${command}`);
      
      // Start agent without waiting for it to complete
      const child = exec(command, (error, stdout, stderr) => {
        if (error) {
          logError(`Failed to start agent for room ${room}`, error);
          activeSessions[room].status = 'error';
          activeSessions[room].error = error.message;
          console.error('Command that failed:', command);
          return;
        }
        if (stderr) {
          console.log(`⚠️ Agent stderr:`, stderr);
        }
        console.log(`✅ Agent stdout:`, stdout);
        // If we get output without errors, update status to connected
        if (stdout && !stderr) {
          activeSessions[room].status = 'connected';
          console.log(`✅ Agent successfully connected to room ${room}`);
        }
      });
      
      // Store process ID for potential termination later
      if (child.pid) {
        activeSessions[room].pid = child.pid;
      }
      
      // Return response immediately while agent starts in background
      return NextResponse.json({
        status: 'connecting',
        message: 'Agent is starting in the background',
        room,
        identity: identity || 'ai-assistant'
      });
    } catch (error) {
      logError('Error starting agent process', error);
      activeSessions[room].status = 'error';
      activeSessions[room].error = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ 
        status: 'error',
        message: 'Failed to start agent process',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    logError('Error processing request', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const roomName = req.nextUrl.searchParams.get('room');
  
  if (!roomName) {
    return NextResponse.json({ error: 'Missing room parameter' }, { status: 400 });
  }
  
  // If there's no active session for this room
  if (!activeSessions[roomName]) {
    return NextResponse.json({ 
      status: 'not_connected',
      message: 'No agent is connected to this room' 
    });
  }
  
  try {
    // In a real implementation, we would kill the agent process
    // For now, we'll just mark the session as disconnected
    delete activeSessions[roomName];
    
    return NextResponse.json({
      status: 'disconnected',
      message: 'Agent has been disconnected from the room'
    });
  } catch (error) {
    console.error('Error disconnecting agent:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Failed to disconnect agent'
    }, { status: 500 });
  }
}
