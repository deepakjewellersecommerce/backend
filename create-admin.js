require("dotenv").config();
require("./models/admin.model"); // Load the Admin model
const mongoose = require("mongoose");
const Admin = mongoose.model("Admin");
const bcrypt = require("bcrypt");

mongoose.connect(process.env.MONGO_URI);

const createAdmin = async () => {
  const email = "admin@example.com";
  const password = "admin123";
  const name = "Admin";

  const existingAdmin = await Admin.findOne({ email });
  if (existingAdmin) {
    console.log("Admin already exists");
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const admin = new Admin({
    name,
    email,
    password: hashedPassword,
  });

  await admin.save();
  console.log("Admin created successfully");
  process.exit();
};

createAdmin();