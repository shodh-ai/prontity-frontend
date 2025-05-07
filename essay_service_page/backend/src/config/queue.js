// backend/src/config/queue.js
const { Queue, Worker } = require('bullmq');
require('dotenv').config();

const queueName = 'essay-grading';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  // password: process.env.REDIS_PASSWORD, // Uncomment if password is set
};

// Create a queue instance
const essayGradingQueue = new Queue(queueName, { connection });

console.log(`BullMQ Queue '${queueName}' configured for Redis at ${connection.host}:${connection.port}`);

// Function to add a job to the queue
const addGradingJob = async (jobData) => {
  try {
    await essayGradingQueue.add('gradeEssay', jobData, {
      removeOnComplete: true, // Remove job from queue once completed
      removeOnFail: 50,       // Keep last 50 failed jobs
    });
    console.log(`Added grading job for essayId: ${jobData.essayId}`);
  } catch (error) {
    console.error('Error adding job to queue:', error);
  }
};

module.exports = {
  essayGradingQueue,
  addGradingJob,
  queueName,
  connection,
};
