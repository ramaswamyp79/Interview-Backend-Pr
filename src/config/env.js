const requiredEnv = [
  "JWT_SECRET",
  "CLIENT_ORIGIN",
  "GCS_BUCKET",
  "GEMINI_API_KEY",
  "CLOUDCONVERT_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SENDGRID_API_KEY",
  "SENDGRID_MAIL_FROM",
];

const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnv.join(", ")}`
  );
}

export { requiredEnv };
