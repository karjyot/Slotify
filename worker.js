require('dotenv').config();

const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const { renderTemplate } = require('./utils/template.util');

const MAX_RETRIES = 3;

async function start() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue('send_email', { durable: true });
  await channel.assertQueue('send_email_dlq', { durable: true });

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  console.log('🟢 Email worker started (with templates)');

  channel.consume('send_email', async (msg) => {
    if (!msg) return;

    const payload = JSON.parse(msg.content.toString());
    payload.retryCount = payload.retryCount || 0;

    try {
      if (payload.type === 'FORGOT_PASSWORD') {
        const resetLink =
          `${process.env.FRONTEND_URL}/reset-password?token=${payload.token}`;

        const html = await renderTemplate('forgot-password', {
          resetLink,
          title: 'Reset your password',
        });

        await transporter.sendMail({
          from: process.env.MAIL_FROM,
          to: payload.email,
          subject: 'Reset your password',
          html,
        });

        console.log(`📧 Email sent to ${payload.email}`);
        channel.ack(msg);
      }
    } catch (err) {
      payload.retryCount++;

      if (payload.retryCount > MAX_RETRIES) {
        console.error('❌ Max retries reached → DLQ');

        channel.sendToQueue(
          'send_email_dlq',
          Buffer.from(JSON.stringify(payload)),
          { persistent: true },
        );

        channel.ack(msg);
      } else {
        console.warn(`⚠️ Retry ${payload.retryCount}`);

        channel.sendToQueue(
          'send_email',
          Buffer.from(JSON.stringify(payload)),
          { persistent: true },
        );

        channel.ack(msg);
      }
    }
  });
}

start();
