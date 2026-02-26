/**
 * Generates RFID codes for a product.
 * Format: DJ-{SKU}-{zero-padded serial}
 * Example: DJ-G22FNGBOX11-001
 *
 * @param {string} skuNo - Product SKU
 * @param {number} startSerial - Starting serial number
 * @param {number} count - Number of tags to generate
 * @returns {Array<{rfidCode: string, serialNumber: number}>}
 */
function generateRfidCodes(skuNo, startSerial, count) {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const serial = startSerial + i;
    const paddedSerial = String(serial).padStart(3, "0");
    tags.push({
      rfidCode: `DJ-${skuNo}-${paddedSerial}`,
      serialNumber: serial,
    });
  }
  return tags;
}

module.exports = { generateRfidCodes };
