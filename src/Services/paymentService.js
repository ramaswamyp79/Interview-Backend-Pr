import Stripe from "stripe";
import Payment from "../Model/Payment.js";
import User from "../Model/User.js";

let _stripe;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key);
  return _stripe;
}

const createCheckoutSession = async ({ user, plan, clientOrigin: suppliedOrigin }) => {
  const stripe = getStripe();

  // Allowed origins (CSV) - used to validate any origin supplied by the client
  const allowedOrigins = (process.env.CLIENT_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const envDefaultOrigin = process.env.CLIENT_ORIGIN;

  // Prefer supplied origin only if it's in the allowed list
  let clientOrigin = suppliedOrigin || envDefaultOrigin;
  if (suppliedOrigin) {
    if (!allowedOrigins.includes(suppliedOrigin)) {
      console.warn("⚠️ Supplied origin not in CLIENT_ORIGINS, falling back to env CLIENT_ORIGIN:", suppliedOrigin);
      clientOrigin = envDefaultOrigin;
    }
  }

  if (!clientOrigin) {
    console.error("❌ CLIENT_ORIGIN is missing");
    throw new Error("CLIENT_ORIGIN is not set");
  }

  if (!clientOrigin.startsWith("http://") && !clientOrigin.startsWith("https://")) {
    console.error("❌ Invalid CLIENT_ORIGIN:", clientOrigin);
    throw new Error("CLIENT_ORIGIN must include http/https");
  }

  console.log("🔧 Using clientOrigin for Stripe redirects:", clientOrigin);

  const successUrl = `${clientOrigin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${clientOrigin}/payment-cancel`;

  console.log("✅ Stripe success_url:", successUrl);
  console.log("✅ Stripe cancel_url:", cancelUrl);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,

    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: {
            name: `${plan.title} Interview Credits`,
          },
          unit_amount: plan.amount * 100,
        },
        quantity: 1,
      },
    ],

    success_url: successUrl,
    cancel_url: cancelUrl,

    metadata: {
      userId: user.userId,
      credits: plan.credits,
    },
  });

  await Payment.create({
    userId: user.userId,
    stripeSessionId: session.id,
    amount: plan.amount,
    currency: "INR",
    credits: plan.credits,
    status: "pending",
  });

  return session.url;
};



const fulfillPayment = async (session) => {
  const payment = await Payment.findOne({
    stripeSessionId: session.id,
  });

  if (!payment || payment.status === "paid") return;

  payment.status = "paid";
  await payment.save();

  await User.findByIdAndUpdate(payment.userId, {
    $inc: { credits: payment.credits },
  });
};

export default {
  createCheckoutSession,
  fulfillPayment,
};
