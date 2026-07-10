import { Module } from '@nestjs/common';
import { ProductsController, CategoriesController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
