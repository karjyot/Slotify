import { RabbitMQService } from './queue/rabbitmq.service';
export declare class AppController {
    private rabbit;
    constructor(rabbit: RabbitMQService);
    testRabbit(): Promise<{
        status: string;
    }>;
}
