// One-off test-data patches (approved): copy the booking price onto test job Pn1q..., set end date on test warranty jRNk...
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
(async () => {
  const jref = db.collection("jobs").doc("Pn1qtMv46M0ZptAFH7bD");
  const j = (await jref.get()).data();
  const b = (await db.collection("bookings").doc(j.bookingId).get()).data();
  console.log("job before", j.totalAmount, "booking", b.totalAmount, b.quoteStatus);
  if (b.totalAmount > 0) await jref.update({ priceBreakdown: b.priceBreakdown, totalAmount: b.totalAmount, updatedAt: new Date().toISOString() });
  const wref = db.collection("warranties").doc("jRNk1mV3S6Jxe7mTGLwl");
  const w = (await wref.get()).data();
  console.log("warranty", w && w.startDate, w && w.endDate);
  if (w && !w.endDate) await wref.update({ endDate: "2029-10-02" });
  console.log("DONE");
})();
