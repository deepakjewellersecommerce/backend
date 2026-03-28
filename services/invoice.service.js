const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

class InvoiceService {
  // Generate PDF invoice for an order
  // order must have: orderNumber, items (or products), grandTotal, subtotal,
  //   discountAmount, shippingAmount, taxAmount, payment_mode, payment_status,
  //   shippingAddress, createdAt
  // buyer: { name, email, phoneNumber }
  static async generateInvoice(order, buyer) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: "A4" });

        const fileName = `invoice-${order._id}-${Date.now()}.pdf`;
        const tempDir = path.join(__dirname, "../temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, fileName);

        doc.pipe(fs.createWriteStream(filePath));

        // ── Resolve items (new schema first, fall back to legacy products) ──
        let items = [];
        if (Array.isArray(order.items) && order.items.length > 0) {
          items = order.items.map((it) => ({
            title: it.productTitle || "Product",
            sku: it.skuNo || "",
            qty: it.quantity || 1,
            unitPrice: it.price ?? it.priceAtOrder ?? 0,
            lineTotal: it.lineTotal ?? (it.price ?? 0) * (it.quantity || 1),
          }));
        } else if (Array.isArray(order.products) && order.products.length > 0) {
          items = order.products.map((p) => {
            const prod = p.product ?? {};
            const title =
              prod.productTitle || prod.displayName || "Product";
            const unitPrice = p.price ?? 0;
            const qty = p.quantity || 1;
            return { title, sku: prod.skuNo || "", qty, unitPrice, lineTotal: unitPrice * qty };
          });
        }

        // ── Totals ──
        const subtotal = order.subtotal ?? items.reduce((s, i) => s + i.lineTotal, 0);
        const discount = order.discountAmount ?? 0;
        const shipping = order.shippingAmount ?? 0;
        const tax = order.taxAmount ?? 0;
        const grandTotal = order.grandTotal ?? subtotal - discount + shipping + tax;

        // ── Invoice number & date ──
        const invoiceNo =
          order.orderNumber ||
          `INV-${String(order._id).slice(-8).toUpperCase()}`;
        const invoiceDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

        // ────────────────────────────────────────────────────────────────────
        // HEADER
        // ────────────────────────────────────────────────────────────────────
        const PAGE_W = doc.page.width;
        const MARGIN = 50;
        const CONTENT_W = PAGE_W - MARGIN * 2;

        // Brand name (left)
        doc
          .fillColor("#1a1a2e")
          .fontSize(22)
          .font("Helvetica-Bold")
          .text("DJ Jewellery", MARGIN, MARGIN);

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#666")
          .text("Premium Jewellery", MARGIN, MARGIN + 26)
          .text("info@djjewellery.com", MARGIN, MARGIN + 38);

        // "INVOICE" label (right)
        doc
          .fontSize(28)
          .font("Helvetica-Bold")
          .fillColor("#7c3aed")
          .text("INVOICE", MARGIN, MARGIN, { align: "right", width: CONTENT_W });

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#444")
          .text(`Invoice No: ${invoiceNo}`, MARGIN, MARGIN + 34, {
            align: "right",
            width: CONTENT_W,
          })
          .text(`Date: ${invoiceDate}`, MARGIN, MARGIN + 46, {
            align: "right",
            width: CONTENT_W,
          })
          .text(`Payment: ${order.payment_mode ?? ""}  ·  ${order.payment_status ?? ""}`, MARGIN, MARGIN + 58, {
            align: "right",
            width: CONTENT_W,
          });

        // Divider
        const divY = MARGIN + 76;
        doc.moveTo(MARGIN, divY).lineTo(PAGE_W - MARGIN, divY).lineWidth(1).strokeColor("#7c3aed").stroke();

        // ────────────────────────────────────────────────────────────────────
        // BILL TO / SHIP TO
        // ────────────────────────────────────────────────────────────────────
        const addrY = divY + 16;
        const COL2_X = MARGIN + CONTENT_W / 2 + 10;

        // Bill To
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#7c3aed")
          .text("BILL TO", MARGIN, addrY);
        doc.font("Helvetica").fillColor("#222").fontSize(10);

        const buyerName = buyer?.name || "Customer";
        const buyerEmail = buyer?.email || "";
        const buyerPhone = buyer?.phoneNumber ? String(buyer.phoneNumber) : "";

        let billY = addrY + 14;
        doc.text(buyerName, MARGIN, billY);
        if (buyerEmail) { billY += 13; doc.text(buyerEmail, MARGIN, billY); }
        if (buyerPhone) { billY += 13; doc.text(buyerPhone, MARGIN, billY); }

        // Ship To
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#7c3aed")
          .text("SHIP TO", COL2_X, addrY);
        doc.font("Helvetica").fillColor("#222").fontSize(10);

        const addr = order.shippingAddress ?? {};
        const shipLines = [
          addr.name || buyerName,
          addr.address,
          [addr.city, addr.state].filter(Boolean).join(", "),
          addr.pincode ? `PIN: ${addr.pincode}` : "",
          addr.phone || buyerPhone,
        ].filter(Boolean);

        let shipY = addrY + 14;
        for (const line of shipLines) {
          doc.text(line, COL2_X, shipY, { width: CONTENT_W / 2 - 10 });
          shipY += 13;
        }

        // ────────────────────────────────────────────────────────────────────
        // ITEMS TABLE
        // ────────────────────────────────────────────────────────────────────
        const tableY = Math.max(billY, shipY) + 24;

        // Column positions
        const COL = {
          num:   MARGIN,
          title: MARGIN + 22,
          sku:   MARGIN + 230,
          qty:   MARGIN + 330,
          price: MARGIN + 380,
          total: MARGIN + 440,
        };

        // Header row background
        doc.rect(MARGIN, tableY, CONTENT_W, 20).fill("#7c3aed");
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#fff");
        doc.text("#",        COL.num,   tableY + 5, { width: 20 });
        doc.text("Item",     COL.title, tableY + 5, { width: 200 });
        doc.text("SKU",      COL.sku,   tableY + 5, { width: 90 });
        doc.text("Qty",      COL.qty,   tableY + 5, { width: 44, align: "right" });
        doc.text("Price",    COL.price, tableY + 5, { width: 54, align: "right" });
        doc.text("Amount",   COL.total, tableY + 5, { width: 60, align: "right" });

        // Rows
        let rowY = tableY + 22;
        doc.font("Helvetica").fontSize(9).fillColor("#222");

        items.forEach((item, idx) => {
          const rowH = 20;
          if (idx % 2 === 1) {
            doc.rect(MARGIN, rowY, CONTENT_W, rowH).fill("#f5f3ff");
          }
          doc.fillColor("#222");
          doc.text(String(idx + 1),             COL.num,   rowY + 5, { width: 20 });
          doc.text(item.title,                  COL.title, rowY + 5, { width: 200 });
          doc.text(item.sku || "—",             COL.sku,   rowY + 5, { width: 90 });
          doc.text(String(item.qty),            COL.qty,   rowY + 5, { width: 44, align: "right" });
          doc.text(`₹${item.unitPrice.toFixed(2)}`,  COL.price, rowY + 5, { width: 54, align: "right" });
          doc.text(`₹${item.lineTotal.toFixed(2)}`,  COL.total, rowY + 5, { width: 60, align: "right" });
          rowY += rowH;
        });

        // Thin line below items
        doc.moveTo(MARGIN, rowY + 4).lineTo(PAGE_W - MARGIN, rowY + 4).lineWidth(0.5).strokeColor("#ddd").stroke();

        // ────────────────────────────────────────────────────────────────────
        // TOTALS
        // ────────────────────────────────────────────────────────────────────
        const TOTALS_LABEL_X = MARGIN + CONTENT_W - 180;
        const TOTALS_VALUE_X = MARGIN + CONTENT_W - 60;
        let totY = rowY + 14;

        const addTotalRow = (label, value, bold = false, color = "#222") => {
          doc
            .font(bold ? "Helvetica-Bold" : "Helvetica")
            .fontSize(bold ? 10 : 9)
            .fillColor(color)
            .text(label, TOTALS_LABEL_X, totY, { width: 110 })
            .text(value,  TOTALS_VALUE_X, totY, { width: 60, align: "right" });
          totY += bold ? 16 : 14;
        };

        addTotalRow("Subtotal",     `₹${subtotal.toFixed(2)}`);
        if (discount > 0) addTotalRow("Discount",   `-₹${discount.toFixed(2)}`, false, "#16a34a");
        if (shipping > 0) addTotalRow("Shipping",   `₹${shipping.toFixed(2)}`);
        if (tax > 0)      addTotalRow("Tax",        `₹${tax.toFixed(2)}`);

        // Grand total line
        doc.moveTo(TOTALS_LABEL_X, totY).lineTo(PAGE_W - MARGIN, totY).lineWidth(0.5).strokeColor("#7c3aed").stroke();
        totY += 6;
        addTotalRow("Grand Total", `₹${grandTotal.toFixed(2)}`, true, "#7c3aed");

        // ────────────────────────────────────────────────────────────────────
        // COUPON
        // ────────────────────────────────────────────────────────────────────
        if (order.couponCode) {
          totY += 4;
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#16a34a")
            .text(
              `Coupon applied: ${order.couponCode}`,
              TOTALS_LABEL_X, totY,
              { width: 170 }
            );
          totY += 12;
        }

        // ────────────────────────────────────────────────────────────────────
        // FOOTER
        // ────────────────────────────────────────────────────────────────────
        const footerY = doc.page.height - 80;
        doc
          .moveTo(MARGIN, footerY)
          .lineTo(PAGE_W - MARGIN, footerY)
          .lineWidth(0.5)
          .strokeColor("#ddd")
          .stroke();

        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#888")
          .text("Thank you for your purchase!", MARGIN, footerY + 10, {
            align: "center",
            width: CONTENT_W,
          })
          .text(
            "For queries contact: info@djjewellery.com",
            MARGIN, footerY + 22,
            { align: "center", width: CONTENT_W }
          );

        doc.end();
        doc.on("finish", () => resolve({ filePath, fileName }));
        doc.on("error", reject);
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = InvoiceService;
