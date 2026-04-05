
const mongoose = require("mongoose");
require("dotenv").config();

// Define a minimal Order schema for the check
const OrderSchema = new mongoose.Schema({
  createdAt: Date
}, { strict: false });

const User_Order = mongoose.models.User_Order || mongoose.model("User_Order", OrderSchema);

async function checkDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jewelry');
    console.log("Connected to MongoDB");

    const targetDateStr = "2026-04-03";
    
    // 1. Old UTC Logic
    const oldStart = new Date(targetDateStr + 'T00:00:00.000Z');
    const oldEnd = new Date(targetDateStr + 'T23:59:59.999Z');
    
    // 2. New IST Logic (Appending +05:30)
    // When we append +05:30 to a date string like "2026-04-03T00:00:00.000+05:30"
    // it means 00:00:00 IST, which is 18:30:00 UTC of the previous day.
    const newStart = new Date(targetDateStr + 'T00:00:00.000+05:30');
    const newEnd = new Date(targetDateStr + 'T23:59:59.999+05:30');

    console.log("--- Range Profiles ---");
    console.log(`Target Date: ${targetDateStr}`);
    console.log(`Old UTC Range: ${oldStart.toISOString()} to ${oldEnd.toISOString()}`);
    console.log(`New IST Range: ${newStart.toISOString()} to ${newEnd.toISOString()}`);
    console.log("----------------------\n");

    const oldCount = await User_Order.countDocuments({
      createdAt: { $gte: oldStart, $lte: oldEnd }
    });

    const newCount = await User_Order.countDocuments({
      createdAt: { $gte: newStart, $lte: newEnd }
    });

    console.log(`Old UTC Count: ${oldCount}`);
    console.log(`New IST Count: ${newCount}`);
    
    if (newCount !== oldCount) {
      console.log(`Mismatch found! Difference: ${Math.abs(newCount - oldCount)} orders.`);
    } else {
      console.log("Counts are same for this specific day.");
    }

    // Check for "Late Night" orders specifically
    // Late night IST (e.g., 2026-04-03 23:30:00 IST) is 2026-04-03 18:00:00 UTC.
    // This order IS in both ranges.
    
    // What orders are in NEW but NOT OLD?
    // Orders between newStart (Apr 2nd 18:30 UTC) and oldStart (Apr 3rd 00:00 UTC)
    // These are early morning IST (00:00 to 05:30 IST) on Apr 3rd.
    const inNewNotOld = await User_Order.countDocuments({
      createdAt: { $gte: newStart, $lt: oldStart }
    });
    
    // What orders are in OLD but NOT NEW?
    // Orders between newEnd (Apr 3rd 18:30 UTC) and oldEnd (Apr 3rd 23:59 UTC)
    // These are early morning IST (00:00 to 05:30 IST) on Apr 4th.
    const inOldNotNew = await User_Order.countDocuments({
      createdAt: { $gte: newEnd, $gt: oldEnd }
    });
    // Correction: newEnd is Apr 3rd 18:30 UTC. oldEnd is Apr 3rd 23:59 UTC.
    // So orders between 18:30 UTC and 23:59 UTC on Apr 3rd are in OLD but NOT NEW.
    // These orders are Apr 4th IST (00:00 to 05:30 IST).
    const earlyMorningNextDayIST = await User_Order.countDocuments({
      createdAt: { $gt: newEnd, $lte: oldEnd }
    });

    console.log(`\nOrders in early morning IST (00:00-05:30) on Apr 3rd: ${inNewNotOld}`);
    console.log(`Orders in early morning IST (00:00-05:30) on Apr 4th: ${earlyMorningNextDayIST}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkDates();
