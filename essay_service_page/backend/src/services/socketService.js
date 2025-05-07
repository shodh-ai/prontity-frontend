// backend/src/services/socketService.js
const { Server } = require('socket.io');
const db = require('../config/db'); // Import database connection
const { Schema } = require('prosemirror-model');
const { Step } = require('prosemirror-transform');
const { schema: basicSchema } = require('prosemirror-schema-basic');

// Create a basic schema instance (align this with Tiptap's schema if customized)
const schema = new Schema({
  nodes: basicSchema.spec.nodes,
  marks: basicSchema.spec.marks
});

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3001"], // Allow both possible frontend ports
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  console.log('Socket.io server initialized');

  // Use the main namespace with rooms instead of dynamic namespaces
  io.on('connection', (socket) => {
    console.log(`Client connected, Socket ID: ${socket.id}`);
    let currentEssayId = null;
    
    // Handle joining an essay room
    socket.on('join-essay', ({ essayId }) => {
      if (!essayId) {
        socket.emit('error', { message: 'Essay ID is required' });
        return;
      }
      
      // Join a room specific to the essay ID
      socket.join(essayId);
      currentEssayId = essayId; // Store the essay ID for this socket
      console.log(`Client ${socket.id} joined essay room: ${essayId}`);
      
      // Let the client know they've successfully joined
      socket.emit('joined-essay', { essayId });
    });
    
    // Handle direct content updates (simplified approach)
    socket.on('content-update', (data) => {
      const { essayId, content, clientId } = data;
      const targetEssayId = essayId || currentEssayId;
      
      if (!targetEssayId) {
        console.warn('Content update received without essay ID');
        return;
      }
      
      console.log(`Content update from client ${clientId} for essay ${targetEssayId}`);  
      
      // Broadcast to all other clients in the same essay room
      socket.to(targetEssayId).emit('content-update', data);
      
      // Store the content in the database (optional, but good for persistence)
      // This is a simplified approach - in production you'd want to handle this more carefully
      if (content) {
        try {
          const dbClient = db.pool.connect(); // Get a client from the pool
          dbClient.then(client => {
            client.query(
              'UPDATE essays SET content = $1 WHERE id = $2',
              [content, targetEssayId]
            ).then(() => {
              console.log(`Updated essay ${targetEssayId} content in database`);
              client.release(); // Release the client back to the pool
            }).catch(err => {
              console.error('Error updating essay content:', err);
              client.release(); // Always release the client on error
            });
          }).catch(err => {
            console.error('Error getting database client:', err);
          });
        } catch (error) {
          console.error('Error in database operation:', error);
        }
      }
    });

    // Handle editor updates from a client
    socket.on('editor-update', async (data) => {
      const { essayId, version: clientVersion, steps: clientSteps, clientId } = data;
      const targetEssayId = essayId || currentEssayId;
      
      if (!targetEssayId) {
        socket.emit('error', { message: 'No essay ID provided or stored' });
        return;
      }
      
      console.log(`Received editor-update for essay ${targetEssayId} from ${clientId || socket.id}: version ${clientVersion}, steps: ${clientSteps?.length || 0}`);

      // Validate input data
      if (!clientSteps || !Array.isArray(clientSteps) || clientSteps.length === 0) {
        socket.emit('error', { message: 'Invalid steps data' });
        return;
      }
      
      const dbClient = await db.pool.connect(); // Get client from pool for transaction
      try {
        await dbClient.query('BEGIN');

        // Fetch current document and version, locking the row
        const essayRes = await dbClient.query(
          'SELECT content, version FROM essays WHERE id = $1 FOR UPDATE',
          [targetEssayId]
        );

        if (essayRes.rows.length === 0) {
          throw new Error(`Essay not found: ${targetEssayId}`);
        }

        const currentDbVersion = essayRes.rows[0].version;
        const currentContent = essayRes.rows[0].content;

        // Version check
        if (clientVersion !== currentDbVersion) {
          console.warn(`Version mismatch for essay ${targetEssayId}. Client: ${clientVersion}, DB: ${currentDbVersion}. Aborting update.`);
          // Notifying the client of version mismatch
          socket.emit('version-mismatch', { 
            message: 'Document version is out of date', 
            currentVersion: currentDbVersion,
            content: currentContent
          });
          await dbClient.query('ROLLBACK'); // Abort transaction
          return; // Stop processing this update
        }

        // --- Apply steps --- 
        let doc = schema.nodeFromJSON(currentContent);
        let transform = doc.type.createTransform(); // Deprecated but works
        // Newer API: let tr = new Transform(doc);

        const prosemirrorSteps = clientSteps.map(stepJSON => {
            const step = Step.fromJSON(schema, stepJSON);
            if (!step) {
                throw new Error(`Could not deserialize step: ${JSON.stringify(stepJSON)}`);
            }
            transform = transform.step(step);
            // Newer API: tr.step(step);
            return step; // Keep the step object if needed for logging
        });

        const newDoc = transform.doc; // Get the updated document
        const newVersion = currentDbVersion + 1;

        // --- Persist changes --- 
        // 1. Update the main essay document and version
        await dbClient.query(
          'UPDATE essays SET content = $1, version = $2 WHERE id = $3',
          [newDoc.toJSON(), newVersion, targetEssayId]
        );

        // 2. Log the steps (optional, but good for recovery/auditing)
        await dbClient.query(
          'INSERT INTO essay_steps (essay_id, version, steps, client_id) VALUES ($1, $2, $3, $4)',
          [targetEssayId, newVersion, JSON.stringify(clientSteps), clientId || socket.id]
        );

        await dbClient.query('COMMIT'); // Commit the transaction

        console.log(`Successfully applied steps for essay ${targetEssayId}. New version: ${newVersion}`);

        // Broadcast the update (steps and NEW version) to all *other* clients in the room
        socket.to(targetEssayId).emit('editor-update', {
          version: newVersion,
          steps: clientSteps, // Send original steps back
          clientId: clientId || socket.id // Identify the originator
        });

      } catch (error) {
        await dbClient.query('ROLLBACK'); // Rollback on any error
        console.error(`Error processing editor-update:`, error);
        // Optionally notify the client of the failure
        socket.emit('editor-update-failed', { message: 'Failed to save changes. Please try again.' });
      } finally {
        dbClient.release(); // Release client back to the pool
      }
    });

    // Handle cursor updates (optional, if using collaboration-cursor)
    socket.on('cursor-update', (data) => {
      const { essayId } = data;
      const targetEssayId = essayId || currentEssayId;
      
      if (!targetEssayId) return;
      
      socket.to(targetEssayId).emit('cursor-update', { 
        ...data, 
        clientId: data.clientId || socket.id 
      });
    });

    socket.on('disconnect', (reason) => {
      if (currentEssayId) {
        console.log(`Client disconnected from essay ${currentEssayId}, Socket ID: ${socket.id}. Reason: ${reason}`);
        // Broadcast disconnect to clean up cursors
        socket.to(currentEssayId).emit('client-disconnected', { clientId: socket.id });
      } else {
        console.log(`Client disconnected, Socket ID: ${socket.id}. Reason: ${reason}`);
      }
    });

    socket.on('error', (error) => {
      console.error(`Socket error, Socket ID: ${socket.id}:`, error);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

module.exports = {
  initSocket,
  getIO,
};
