import { fetchFlowTask, nextFlowTask, FlowResponse } from '@/api/pronityClient';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// Map task types to page routes
export const TASK_PAGE_MAPPING: Record<string, string> = {
  'reading': '/listeningpage_update',
  'writing': '/writingpage_tiptap_update',
  'speaking': '/letusspeak',  // Updated to use the enhanced letusspeak page with Web Speech API
  'vocab': '/vocabpage'
};

/**
 * Navigates to the current task in the user's flow
 * @param router Next.js router instance
 * @param token JWT authentication token
 * @returns Promise with the flow data
 */
export async function navigateToCurrentTask(router: AppRouterInstance, token: string): Promise<FlowResponse> {
  try {
    console.log('Getting current task from backend...');
    
    // Get current task from backend
    const flowData = await fetchFlowTask(token);
    console.log('Received flow data:', flowData);
    
    // Get the corresponding page URL
    const taskType = flowData.currentTask.taskType;
    const baseUrl = TASK_PAGE_MAPPING[taskType] || '/';
    
    // Construct URL with query parameters
    const url = `${baseUrl}?topicId=${flowData.currentTask.topic.topicId}&taskId=${flowData.currentTask.taskId}&flowPosition=${flowData.currentPosition}&totalTasks=${flowData.totalTasks}`;
    
    console.log(`Navigating to: ${url}`);
    
    // Navigate to the page
    router.push(url);
    
    return flowData;
  } catch (error) {
    console.error('Error navigating to task:', error);
    throw error;
  }
}

/**
 * Navigates to the next task in the user's flow
 * @param router Next.js router instance
 * @param token JWT authentication token
 * @returns Promise with the flow data
 */
export async function navigateToNextTask(router: AppRouterInstance, token: string): Promise<FlowResponse> {
  try {
    console.log('Getting next task from backend...');
    
    // Get next task from backend
    const flowData = await nextFlowTask(token);
    console.log('Received next flow data:', flowData);
    
    // Get the corresponding page URL
    const taskType = flowData.currentTask.taskType;
    const baseUrl = TASK_PAGE_MAPPING[taskType] || '/';
    
    // Construct URL with query parameters
    const url = `${baseUrl}?topicId=${flowData.currentTask.topic.topicId}&taskId=${flowData.currentTask.taskId}&flowPosition=${flowData.currentPosition}&totalTasks=${flowData.totalTasks}`;
    
    console.log(`Navigating to: ${url}`);
    
    // Navigate to the page
    router.push(url);
    
    return flowData;
  } catch (error) {
    console.error('Error navigating to next task:', error);
    throw error;
  }
}

/**
 * Gets flow data for display without navigation
 * @param token JWT authentication token
 * @returns Promise with the flow data
 */
export async function getFlowData(token: string): Promise<FlowResponse> {
  try {
    // Get current task from backend
    return await fetchFlowTask(token);
  } catch (error) {
    console.error('Error getting flow data:', error);
    throw error;
  }
}

/**
 * Formats the task topic for display
 * @param flowData The flow response data
 * @returns Formatted topic string
 */
export function formatTaskTopic(flowData: FlowResponse): string {
  if (!flowData?.currentTask?.topic) return 'Unknown Topic';
  
  const { topicId, name, description } = flowData.currentTask.topic;
  return name || description || topicId || 'Unknown Topic';
}
