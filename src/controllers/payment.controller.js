import paymentService from "../Services/paymentService.js";
import Stripe from "stripe";

/**
 * Create Stripe Checkout session
 * Returns checkout URL (NOT session id)
 */
export const createCheckout = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ message: "Plan is required" });
    }

    // Prefer client Origin header (from browser) so frontend running locally can receive Stripe redirects
    const ref = req.get("referer");
    const originHeader = req.get("origin") || (ref && ref.split("/").slice(0, 3).join("/"));
    const clientOrigin = originHeader || process.env.CLIENT_ORIGIN;

    // ✅ This must return session.url
    const checkoutUrl = await paymentService.createCheckoutSession({
      user: req.user,
      plan,
      clientOrigin,
    });

    return res.json({ url: checkoutUrl });
  } catch (err) {
    console.error("createCheckout error:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Stripe webhook (recommended for production)
 */
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    await paymentService.fulfillPayment(event.data.object);
  }

  res.json({ received: true });
};

/**
 * Client-side verification after redirect
 * (Safe + idempotent)
 */
export const verifyCheckout = async (req, res) => {
  try {
    const sessionId = req.body.session_id || req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ message: "Missing session_id" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      await paymentService.fulfillPayment(session);
      return res.json({ ok: true });
    }

    return res.json({
      ok: false,
      payment_status: session.payment_status,
    });
  } catch (err) {
    console.error("verifyCheckout error:", err);
    return res.status(500).json({ message: err.message });
  }
};
