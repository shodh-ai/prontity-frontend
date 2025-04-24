/**
 * Request logging middleware
 */

const requestLogger = (req, res, next) => {
  // Generate a unique request ID
  req.requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  // Log request details
  const startTime = Date.now();
  
  // Log request start
  console.log(`[${req.requestId}] ${req.method} ${req.originalUrl} started at ${new Date().toISOString()}`);
  
  // Log request body if it exists (but don't log sensitive information)
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    // Remove sensitive fields if present
    if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';
    console.log(`[${req.requestId}] Request body: ${JSON.stringify(sanitizedBody)}`);
  }
  
  // Override end method to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);
    const duration = Date.now() - startTime;
    console.log(`[${req.requestId}] ${req.method} ${req.originalUrl} completed with status ${res.statusCode} in ${duration}ms`);
  };
  
  next();
};

module.exports = {
  requestLogger
};
