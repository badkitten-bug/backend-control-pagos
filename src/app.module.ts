import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ContractsModule } from './contracts/contracts.module';
import { PaymentSchedulesModule } from './payment-schedules/payment-schedules.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { ClientsModule } from './clients/clients.module';
import { AuditModule } from './audit/audit.module';
import { SubcontractsModule } from './subcontracts/subcontracts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            type: 'postgres',
            url: process.env.DATABASE_URL,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            ssl: { rejectUnauthorized: false },
          }
        : {
            // Demo / local: SQLite sin configurar Postgres (datos efímeros en Render)
            type: 'better-sqlite3',
            database: join(process.cwd(), 'database.sqlite'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
          },
    ),
    AuditModule, // Global module, register first
    AuthModule,
    UsersModule,
    VehiclesModule,
    ContractsModule,
    PaymentSchedulesModule,
    PaymentsModule,
    ReportsModule,
    SettingsModule,
    ClientsModule,
    SubcontractsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

