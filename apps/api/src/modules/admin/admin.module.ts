import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OrdersModule } from './orders/orders.module';
import { StoresModule } from './stores/stores.module';
import { AdminTasksModule } from './tasks/admin-tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DashboardModule,
    UsersModule,
    OrdersModule,
    AdminTasksModule,
    StoresModule,
    CategoriesModule,
  ],
})
export class AdminModule {}
