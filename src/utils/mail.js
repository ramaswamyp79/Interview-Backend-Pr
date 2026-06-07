import sendgrid from "@sendgrid/mail";

let configured = false;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

function configureSendGrid() {
  if (configured) return;

  sendgrid.setApiKey(requireEnv("SENDGRID_API_KEY"));
  configured = true;
}

function stripHtml(value) {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function serializeSendGridError(error) {
  return {
    message: error?.message,
    code: error?.code,
    statusCode: error?.response?.statusCode || error?.response?.status,
    body: error?.response?.body,
  };
}

export async function sendEmail({ to, subject, text, html }) {
  configureSendGrid();

  if (!to) {
    throw new Error("Email recipient is required");
  }

  const message = {
    to,
    from: requireEnv("SENDGRID_MAIL_FROM"),
    subject,
    text: text || stripHtml(html),
    html,
  };

  try {
    await sendgrid.send(message);
  } catch (error) {
    console.error("SendGrid email send failed", serializeSendGridError(error));
    throw error;
  }
}

export async function sendOtpEmail(email, otp) {
  await sendEmail({
    to: email,
    subject: "OTP for Password Reset",
    text: `Your password reset OTP is ${otp}. This OTP expires in 10 minutes.`,
    html: `
      <h2>Password Reset OTP</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP expires in 10 minutes.</p>
    `,
  });

  console.log("OTP email sent to:", email);
}
