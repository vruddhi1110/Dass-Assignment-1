const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/', protect, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded' });
  }
  // Return the path to the uploaded file relative to the server
  // Assuming the server serves 'uploads' folder statically
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ 
    fileUrl, 
    fileName: req.file.originalname,
    fileType: req.file.mimetype 
  });
});

module.exports = router;
