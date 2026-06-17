import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import type { OnlyOfficeJwtPayload } from './types/onlyoffice.types';

function trimSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

@Injectable()
export class OnlyOfficeConfigService {
  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return (
      (
        this.config.get<string>('ONLYOFFICE_ENABLED') ?? 'true'
      ).toLowerCase() !== 'false'
    );
  }

  get documentServerPublicUrl() {
    return trimSlash(
      this.config.get<string>('ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL') ??
        this.config.get<string>('ONLYOFFICE_DOCUMENT_SERVER_URL') ??
        '',
    );
  }

  get documentServerInternalUrl() {
    return trimSlash(
      this.config.get<string>('ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL') ??
        this.documentServerPublicUrl,
    );
  }

  get documentServerUrl() {
    return this.documentServerPublicUrl;
  }

  get callbackBaseUrl() {
    return trimSlash(
      this.config.get<string>('ONLYOFFICE_CALLBACK_BASE_URL') ?? '',
    );
  }

  get fileBaseUrl() {
    return trimSlash(
      this.config.get<string>('ONLYOFFICE_FILE_BASE_URL') ??
        this.config.get<string>('ONLYOFFICE_FILE_PUBLIC_BASE_URL') ??
        '',
    );
  }

  get filePublicBaseUrl() {
    return this.fileBaseUrl;
  }

  get missingConfig() {
    if (!this.enabled) return [];
    const missing: string[] = [];
    if (!this.documentServerPublicUrl)
      missing.push('ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL');
    if (!this.callbackBaseUrl) missing.push('ONLYOFFICE_CALLBACK_BASE_URL');
    if (!this.fileBaseUrl) missing.push('ONLYOFFICE_FILE_BASE_URL');
    if (this.jwtEnabled && !this.jwtSecret)
      missing.push('ONLYOFFICE_JWT_SECRET');
    return missing;
  }

  get editorMode() {
    return this.config.get<string>('ONLYOFFICE_EDITOR_MODE') || 'edit';
  }

  get jwtEnabled() {
    return (
      (
        this.config.get<string>('ONLYOFFICE_JWT_ENABLED') ?? 'false'
      ).toLowerCase() === 'true'
    );
  }

  get forceSaveEnabled() {
    return (
      (
        this.config.get<string>('ONLYOFFICE_FORCE_SAVE_ENABLED') ?? 'false'
      ).toLowerCase() === 'true'
    );
  }

  get jwtSecret() {
    return this.config.get<string>('ONLYOFFICE_JWT_SECRET') || '';
  }

  get signingSecret() {
    return this.jwtSecret || 'local-onlyoffice-dev-secret';
  }

  signSystemUrl(parts: Record<string, string | number | undefined>) {
    const canonical = Object.entries(parts)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('&');
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(canonical)
      .digest('hex');
  }

  verifySystemUrl(
    parts: Record<string, string | number | undefined>,
    signature?: string,
  ) {
    if (!signature) return false;
    const expected = this.signSystemUrl(parts);
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== signatureBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  }

  signJwt(payload: OnlyOfficeJwtPayload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64Url(JSON.stringify(header));
    const encodedPayload = base64Url(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
  }

  verifyJwt(token?: string) {
    if (!token) return false;
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return false;
    const expected = base64Url(
      crypto
        .createHmac('sha256', this.signingSecret)
        .update(`${header}.${payload}`)
        .digest(),
    );
    if (expected !== signature) return false;
    try {
      const parsed = JSON.parse(
        Buffer.from(
          payload.replace(/-/g, '+').replace(/_/g, '/'),
          'base64',
        ).toString('utf8'),
      ) as OnlyOfficeJwtPayload;
      if (
        typeof parsed.exp === 'number' &&
        parsed.exp < Math.floor(Date.now() / 1000)
      )
        return false;
      return true;
    } catch {
      return false;
    }
  }
}
