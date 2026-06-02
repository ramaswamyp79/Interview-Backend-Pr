import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

export const sendOtpEmail = async (email, otp) => {

  const mailOptions = {
    from: `"AI Interview Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "OTP for Password Reset",
    html: `
      <h2>Password Reset OTP</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP expires in 10 minutes.</p>
    `,
  };

  await transporter.sendMail(mailOptions);

  console.log("OTP Email sent to:", email);
};