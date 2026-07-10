import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      message: 'Welcome to the Smart Textile E-Commerce API',
      status: 'online',
      version: '1.0.0',
    };
  }
}
