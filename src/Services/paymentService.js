import Stripe from "stripe";
import admin from "firebase-admin";
import db from "../config/db.js";
import { formatPaymentData } from "../Model/Payment.js";

// 🔥 OPTIMIZATION: Singleton pattern for Stripe. 
// We export this so the controller can reuse this exact instance instead of booting new ones.
let _stripe;
export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key);
  return _stripe;
}

const createCheckoutSession = async ({ user, plan }) => {
  if (!user || !user._id) {
    throw new Error("Invalid user: _id missing");
  }

  const stripe = getStripe();
  const clientOrigin = process.env.CLIENT_ORIGIN;
  if (!clientOrigin) throw new Error("CLIENT_ORIGIN is not set");

  const successUrl = `${clientOrigin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${clientOrigin}/payment-cancel`;

  // Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: { name: `${plan.title} Interview Credits` },
          unit_amount: plan.amount * 100,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: user._id, 
      credits: plan.credits.toString(),
    },
  });

  // Save payment record to Firestore
  const paymentRef = db.collection("payments").doc();
  const paymentData = formatPaymentData({
    userId: user._id,
    stripeSessionId: session.id,
    amount: plan.amount,
    currency: "INR",
    credits: plan.credits,
    status: "pending",
  });

  await paymentRef.set(paymentData);

  return session.url;
};

const fulfillPayment = async (session) => {
  const snapshot = await db.collection("payments")
    .where("stripeSessionId", "==", session.id)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const paymentDoc = snapshot.docs[0];
  const paymentData = paymentDoc.data();

  // Skip if already fulfilled, BUT return the credits so the frontend knows what happened
  if (paymentData.status === "paid") {
    return { credits: paymentData.credits, alreadyPaid: true };
  }

  // Update payment status to paid
  await paymentDoc.ref.update({
    status: "paid",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Atomically increment user credits
  const userRef = db.collection("users").doc(paymentData.userId);
  await userRef.update({
    credits: admin.firestore.FieldValue.increment(paymentData.credits),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 🔥 FIXED: Return the credits so the controller can pass them to the frontend
  return { credits: paymentData.credits, alreadyPaid: false };
};

export default {
  createCheckoutSession,
  fulfillPayment,
};
