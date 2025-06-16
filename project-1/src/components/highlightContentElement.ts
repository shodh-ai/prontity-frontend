/**
 * Highlight a specific content element with visual feedback
 * @param elementId - The ID of the element to highlight
 * @param highlightColor - Optional CSS color for the highlight
 * @param duration - Optional duration in ms to automatically remove highlight (0 = don't auto-remove)
 */
export const highlightContentElement = (
  elementId: string,
  highlightColor?: string,
  duration: number = 0
): void => {
  // Find the element
  const element = document.getElementById(elementId);
  
  if (!element) {
    console.warn(`Could not find element with ID: ${elementId}`);
    return;
  }
  
  // Add highlight class
  element.classList.add('tts-active-highlight');
  
  // Apply custom color if provided
  if (highlightColor) {
    const originalBackgroundColor = element.style.backgroundColor;
    element.style.backgroundColor = highlightColor;
    
    // Reset color when highlight is removed
    if (duration > 0) {
      setTimeout(() => {
        element.style.backgroundColor = originalBackgroundColor;
      }, duration);
    }
  }
  
  // Scroll element into view if needed
  const rect = element.getBoundingClientRect();
  const isInViewport = (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
  
  if (!isInViewport) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  // If duration is specified, remove highlight after that duration
  if (duration > 0) {
    setTimeout(() => {
      element.classList.remove('tts-active-highlight');
    }, duration);
  }
  
  // Dispatch an event for other components to know highlighting happened
  const highlightEvent = new CustomEvent('highlight-applied', {
    detail: { elementId, duration, highlightColor }
  });
  window.dispatchEvent(highlightEvent);
};
