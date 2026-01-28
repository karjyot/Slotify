import { OnModuleInit } from '@nestjs/common';
export declare class RabbitMQService implements OnModuleInit {
    private channel;
    onModuleInit(): Promise<void>;
    publish(queue: string, message: any): Promise<void>;
}
