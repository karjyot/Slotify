import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private channel: amqp.Channel;

  async onModuleInit() {
    const connection = await amqp.connect(process.env.RABBITMQ_URL!);
    this.channel = await connection.createChannel();

    await this.channel.assertQueue('test_queue', {
      durable: true,
    });

    // Dead Letter Queue
    await this.channel.assertQueue('send_email_dlq', {
        durable: true,
    });
    
  // Retry Queue (waits 10 seconds, then sends back to main queue)
  await this.channel.assertQueue('send_email_retry', {
    durable: true,
    arguments: {
      'x-message-ttl': 10000, // 10 seconds
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': 'send_email',
    },
  });

    console.log('✅ RabbitMQ connected');
  }

  async publish(queue: string, message: any) {
    this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
  }


}
