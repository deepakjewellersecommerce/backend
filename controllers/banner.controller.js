const Banner = require("../models/banner.model");
const mongoose = require("mongoose");
const { errorRes, successRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const { uploadOnCloudinary } = require("../middlewares/Cloudinary");

module.exports.addBanner_post = catchAsync(async (req, res) => {
  let { bannerImages, title, content } = req.body;

  // If files are uploaded, handle them via Cloudinary
  if (req.files && req.files.length > 0) {
    const images = [];
    for (const file of req.files) {
      const uploaded = await uploadOnCloudinary(file);
      // store secure_url or url depending on what uploader returns
      if (uploaded && (uploaded.secure_url || uploaded.url)) {
        images.push(uploaded.secure_url || uploaded.url);
      }
    }
    // Also include any string/bannerImage values sent in the form body
    if (bannerImages) {
      if (Array.isArray(bannerImages)) {
        images.push(...bannerImages);
      } else if (typeof bannerImages === 'string') {
        images.push(bannerImages);
      }
    }
    bannerImages = images;
  } else if (bannerImages) {
    // Normalize bannerImages when they are present as strings or array in body
    if (typeof bannerImages === 'string') {
      try {
        // Try parsing JSON arrays sent as strings
        const parsed = JSON.parse(bannerImages);
        if (Array.isArray(parsed)) bannerImages = parsed;
      } catch (e) {
        // not a JSON string, keep as-is
        bannerImages = [bannerImages];
      }
    }
  }

  const banner = await Banner.create({
    bannerImages,
    title,
    content,
  });

  successRes(res, { banner, message: "Banner added successfully." });
});


module.exports.editBanner = catchAsync(async (req, res) => {
  const { id } = req.params;
  // validate id
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid banner id");
  }
  let { bannerImages, title, content } = req.body;

  // If files are uploaded, handle them via Cloudinary
  if (req.files && req.files.length > 0) {
    const images = [];
    for (const file of req.files) {
      const uploaded = await uploadOnCloudinary(file);
      if (uploaded && (uploaded.secure_url || uploaded.url)) {
        images.push(uploaded.secure_url || uploaded.url);
      }
    }
    if (bannerImages) {
      if (Array.isArray(bannerImages)) images.push(...bannerImages);
      else if (typeof bannerImages === 'string') images.push(bannerImages);
    }
    bannerImages = images;
  } else if (bannerImages) {
    if (typeof bannerImages === 'string') {
      try {
        const parsed = JSON.parse(bannerImages);
        if (Array.isArray(parsed)) bannerImages = parsed;
      } catch (e) {
        bannerImages = [bannerImages];
      }
    }
  }

  const banner = await Banner.findByIdAndUpdate(
    id,
    {
      bannerImages,
      title,
      content,
    },
    { new: true }
  );

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { banner, message: "Banner updated successfully." });
});

module.exports.getAllBanners_get = (req, res) => {
  Banner.find()
    .sort("-createdAt")
    .then((banners) => successRes(res, { banners }))
    .catch((err) => internalServerError(res, err));
};

module.exports.deleteBanner = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid banner id");
  }

  const banner = await Banner.findByIdAndDelete(id);

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { message: "Banner deleted successfully." });
});

module.exports.getBannerById = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid banner id");
  }

  const banner = await Banner.findById(id);

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { banner });
});
