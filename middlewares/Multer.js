const multer = require('multer');

// Configure multer for file uploads with better error handling
const upload = multer({
  storage: multer.diskStorage({}),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    // Validate file type - only standard MIME types
    const allowedMimeTypes = [
      'image/jpeg',  // Handles both .jpg and .jpeg extensions
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error(`File type not supported. Allowed types: ${allowedMimeTypes.join(', ')}`),
        false
      );
    }
    
    cb(null, true);
  }
});

module.exports = upload; 
 