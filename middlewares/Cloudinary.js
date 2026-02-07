const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config()
// Configurationsdsd

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, 
});
// Upload
const uploadOnCloudinary = async (filePath) => {
  try {
    console.log("before cloud upload", filePath);
    const data = await cloudinary.uploader.upload(filePath);
    console.log(data, "<<<this is data in cloudinary ");
    return data; // Return the full object, not just data.secure_url
  } catch (error) {
    console.log("Cloudinary upload error:", error.message);
    throw error; // Re-throw to handle in calling function
  }
};
const deleteFromCloudinary = async (url) =>{
  try {
    const deleteResult = await cloudinary.uploader.destroy(url);
    console.log('Image deleted successfully:');
    console.log(deleteResult);
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
  }
}
const uploadPdf = async (file) => {
  try {
    console.log("before clound", file);
    const data = await cloudinary.uploader.upload(file.path);
    console.log(data, "<<<thsis is data incloudinary");
    return data.secure_url;
  } catch (error) {
    console.log(error.message);
  }
};
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, new Date().toISOString().replace(/:/g, "-") + file.originalname);
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
});

module.exports = {uploadOnCloudinary,deleteFromCloudinary};
// module.exports = uploadPdf;
// module.exports = upload;
