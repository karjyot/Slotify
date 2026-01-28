import { Controller, Get } from '@nestjs/common';
import { RabbitMQService } from './queue/rabbitmq.service';

@Controller()
export class AppController {
  constructor(private rabbit: RabbitMQService) {}

  @Get('test-rabbit')
  async testRabbit() {
    await this.rabbit.publish('test_queue', {
      message: 'Hello from NestJS',
      time: new Date().toISOString(),
    });

    return { status: 'Message sent to RabbitMQ' };
  }
}
