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
const uploadOnCloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      return reject(new Error("No file buffer provided"));
    }

    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "auto" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });
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
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit is safer for serverless
  },
});

module.exports = {uploadOnCloudinary,deleteFromCloudinary};
// module.exports = uploadPdf;
// module.exports = upload;
