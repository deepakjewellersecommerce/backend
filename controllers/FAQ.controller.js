const mongoose = require("mongoose");
const FAQ = mongoose.model("FAQ");
const { errorRes, successRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

module.exports.addFAQ_post = catchAsync(async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer)
    return errorRes(res, 400, "All fields are required.");

  const faq = new FAQ({ question, answer });
  return faq
    .save()
    .then(savedFAQ =>
      successRes(res, { FAQ: savedFAQ, message: "FAQ added successfully." })
    )
    .catch(err => internalServerError(res, err));
});

module.exports.deleteFAQ_delete = catchAsync(async (req, res) => {
  const { faqId } = req.params;

  if (!faqId) return errorRes(res, 400, "Invalid request.");

  return FAQ.findByIdAndDelete(faqId)
    .then(deletedFAQ => {
      if (!deletedFAQ) return errorRes(res, 404, "FAQ does not exist");

      successRes(res, { deletedFAQ, message: "FAQ deleted successfully." });
    })
    .catch(err => internalServerError(res, err));
});

module.exports.editFAQ_delete = catchAsync(async (req, res) => {
  const { faqId } = req.params;
  const { question, answer } = req.body;
  const updates = {};

  if (!faqId) return errorRes(res, 400, "Invalid request.");

  if (question) updates.question = question;
  if (answer) updates.answer = answer;

  if (Object.keys(updates).length === 0)
    return errorRes(res, 400, "No updates made.");

  return FAQ.findByIdAndUpdate(faqId, updates, { new: true })
    .then(updatedFAQ => {
      if (!updatedFAQ) return errorRes(res, 404, "FAQ does not exist.");
      successRes(res, { updatedFAQ, message: "FAQ updated successfully." });
    })
    .catch(err => internalServerError(res, err));
});

module.exports.getAllFAQ_get = catchAsync(async (req, res) => {
  return FAQ.find()
    .sort("-createdAt")
    .then(FAQs => successRes(res, { FAQs }))
    .catch(err => internalServerError(res, err));
});
