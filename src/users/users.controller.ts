import { Controller, Get, Query } from '@nestjs/common';
import { ElasticsearchService } from 'src/elasticSearch/elasticsearch.service';

@Controller('users')
export class UsersController {
  constructor(private readonly searchService: ElasticsearchService) {}

  @Get('search')
  search(@Query('q') q: string) {
    return this.searchService.searchUsers(q);
  }
}
