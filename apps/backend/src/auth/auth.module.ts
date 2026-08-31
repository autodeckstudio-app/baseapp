import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/configuration';
import { FIREBASE_ADMIN_APP, createFirebaseAdminApp } from './firebase-admin.provider';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * @Global because the Firebase Admin app instance is foundational — every
 * module that needs Firestore/Auth access depends on it, and requiring each
 * one to separately import AuthModule would add ceremony without adding
 * safety (the provider itself is still the only thing that constructs it).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FIREBASE_ADMIN_APP,
      useFactory: (configService: ConfigService<EnvConfig, true>) =>
        createFirebaseAdminApp({
          projectId: configService.get('FIREBASE_PROJECT_ID', { infer: true }),
          firestoreEmulatorHost: configService.get('FIRESTORE_EMULATOR_HOST', { infer: true }),
          authEmulatorHost: configService.get('FIREBASE_AUTH_EMULATOR_HOST', { infer: true }),
        }),
      inject: [ConfigService],
    },
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [FIREBASE_ADMIN_APP],
})
export class AuthModule {}
