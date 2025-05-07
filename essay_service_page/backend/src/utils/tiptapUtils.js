// backend/src/utils/tiptapUtils.js

/**
 * Recursively extracts plain text from a Tiptap JSON document
 * @param {Object} node - A Tiptap/ProseMirror document node or fragment
 * @returns {string} Plain text content
 */
function getTextFromTiptapJson(node) {
  if (!node) return '';
  
  let text = '';
  
  // If it's a text node with content
  if (node.type === 'text' && node.text) {
    text += node.text;
  }
  
  // If this node has child content, process it recursively
  if (node.content && Array.isArray(node.content)) {
    node.content.forEach(childNode => {
      text += getTextFromTiptapJson(childNode);
    });
  }
  
  // Add appropriate line breaks for block elements
  if (['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(node.type)) {
    if (text.length > 0 && !text.endsWith('\n')) {
      text += '\n';
    }
  }
  
  return text;
}

module.exports = {
  getTextFromTiptapJson
};
