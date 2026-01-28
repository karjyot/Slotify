import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  public client: Client;

  async onModuleInit() {
    this.client = new Client({
      node: 'http://localhost:9200',
    });
    await this.createUserIndex();

  }
  getClient() {
    return this.client;
  }

  async createUserIndex() {
    const exists = await this.client.indices.exists({ index: 'users' });
  
    if (exists) return;
  
    await this.client.indices.create({
      index: 'users',
      mappings: {
        properties: {
          id: { type: 'integer' },
          email: { type: 'keyword' },
          name: { type: 'text' },
          imageUrl: { type: 'keyword' },
          createdAt: { type: 'date' },
        },
      },
    });
  }

  async searchUsers(query: string) {
    const result = await this.client.search({
      index: 'users',
      query: {
        multi_match: {
          query,
          fields: ['name', 'email'],
          fuzziness: 'AUTO',
        },
      },
    });
  
    return result.hits.hits.map(hit => hit._source);
  }
  
}
