import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './queue/queue.module';
import { LoggerModule } from 'nestjs-pino';
import { RedisModule } from './redis/redis.module';
import { ElasticsearchModule } from './elasticSearch/elasticsearch.module';
import { UsersModule } from './users/users.module';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 👈 VERY IMPORTANT
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
      },
    }),
    AuthModule,
    QueueModule,
    RedisModule,
    ElasticsearchModule,
    UsersModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
 