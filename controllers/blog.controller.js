const mongoose = require("mongoose");
const Blog = mongoose.model("Blog");
const {
  errorRes,
  successRes,
  internalServerError,
  shortIdChar,
} = require("../utility");
const catchAsync = require("../utility/catch-async");

const BLOG_STATUSES = new Set(["DRAFT", "PUBLISHED"]);

const normalizeBlogStatus = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();
  return BLOG_STATUSES.has(normalizedStatus) ? normalizedStatus : undefined;
};

module.exports.addBlog_post = catchAsync(async (req, res) => {
  const { title, content, displayImage, status } = req.body;

  const slug = String(title).toLowerCase().split(" ").join("-");

  const slugExists = await Blog.findOne({ slug });

  if (slugExists)
    return errorRes(res, 400, "Blog with this title already exists.");

  const blog = await Blog.create({
    title,
    slug,
    content,
    displayImage,
    status: normalizeBlogStatus(status) || "DRAFT",
  });

  successRes(res, { blog, message: "Blog added successfully." });
});

module.exports.editBlog = catchAsync(async (req, res) => {
  const { _id } = req.params;
  const { title, content, displayImage, status } = req.body;
  const updateData = {
    title,
    content,
    displayImage,
  };

  const normalizedStatus = normalizeBlogStatus(status);
  if (normalizedStatus) {
    updateData.status = normalizedStatus;
  }

  const blog = await Blog.findByIdAndUpdate(
    _id,
    updateData,
    { new: true }
  );
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  successRes(res, { blog, message: "Blog updated successfully." });
});

module.exports.getAllBlogs_get = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, search = "", status, startDate, endDate } = req.query;
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);
  const filter = {};

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { content: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  const normalizedStatus = normalizeBlogStatus(status);
  if (normalizedStatus === "PUBLISHED") {
    filter.status = normalizedStatus;
  }

  if (normalizedStatus === "DRAFT") {
    const draftCondition = { $or: [{ status: "DRAFT" }, { status: { $exists: false } }] };

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, draftCondition];
      delete filter.$or;
    } else {
      filter.$or = draftCondition.$or;
    }
  }

  if (startDate || endDate) {
    filter.createdAt = {};

    if (startDate) {
      const parsedStartDate = new Date(startDate);
      if (!Number.isNaN(parsedStartDate.getTime())) {
        filter.createdAt.$gte = parsedStartDate;
      }
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (!Number.isNaN(parsedEndDate.getTime())) {
        parsedEndDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = parsedEndDate;
      }
    }

    if (Object.keys(filter.createdAt).length === 0) {
      delete filter.createdAt;
    }
  }

  const skip = (parsedPage - 1) * parsedLimit;

  const [blogs, total] = await Promise.all([
    Blog.find(filter).sort("-createdAt").skip(skip).limit(parsedLimit),
    Blog.countDocuments(filter),
  ]);

  successRes(res, { blogs, total, limit: parsedLimit, page: parsedPage });
});

module.exports.deleteBlog = catchAsync(async (req, res) => {
  const { _id } = req.params;
  const blog = await Blog.findByIdAndDelete(_id);
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  successRes(res, { message: "Blog deleted successfully." });
});

module.exports.getBlogById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const blog = await Blog.findById(id);
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  successRes(res, { blog });
});
