import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ElasticsearchModule } from 'src/elasticSearch/elasticsearch.module';

@Module({
  imports: [
    ElasticsearchModule, // ✅ ADD THIS
  ],
  controllers: [UsersController],
})
export class UsersModule {}
