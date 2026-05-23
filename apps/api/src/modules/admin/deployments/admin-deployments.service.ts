import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateDeploymentRecordDto } from './dto/create-deployment-record.dto';

type DeploymentEnv = {
  key: string;
  name: string;
  webBaseUrl?: string;
  apiBaseUrl?: string;
  webhookBaseUrl?: string;
  certsDir?: string;
};

type DeploymentRecord = {
  id: string;
  env: string;
  version: string;
  image?: string;
  commit?: string;
  notes?: string;
  operatorId: string;
  createdAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

@Injectable()
export class AdminDeploymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCertsDir(value?: string): string | undefined {
    const v = (value ?? '').trim().replace(/\/$/, '');
    return v ? v : undefined;
  }

  async getEnvs(): Promise<DeploymentEnv[]> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'DEPLOYMENT_ENVS' },
      select: { value: true },
    });
    const raw = asRecord(row?.value);
    const envs = asArray(raw['envs']).map((x) => {
      const r = asRecord(x);
      const key = asString(r['key']) ?? '';
      const name = asString(r['name']) ?? key;
      const webBaseUrl = asString(r['webBaseUrl']);
      const apiBaseUrl = asString(r['apiBaseUrl']);
      const webhookBaseUrl = asString(r['webhookBaseUrl']);
      const certsDir = asString(r['certsDir']);
      return {
        key,
        name,
        webBaseUrl: webBaseUrl?.trim() || undefined,
        apiBaseUrl: apiBaseUrl?.trim() || undefined,
        webhookBaseUrl: webhookBaseUrl?.trim() || undefined,
        certsDir: this.normalizeCertsDir(certsDir),
      } satisfies DeploymentEnv;
    });

    const valid = envs.filter((e) => e.key.trim());
    if (valid.length) return valid;
    return [
      { key: 'dev', name: '开发环境' },
      { key: 'staging', name: '预发布' },
      { key: 'prod', name: '生产环境' },
    ];
  }

  async upsertEnvs(envs: DeploymentEnv[]): Promise<DeploymentEnv[]> {
    const next = {
      envs: envs.map((e) => {
        return {
          key: e.key.trim(),
          name: e.name.trim(),
          webBaseUrl: e.webBaseUrl?.trim() || '',
          apiBaseUrl: e.apiBaseUrl?.trim() || '',
          webhookBaseUrl: e.webhookBaseUrl?.trim() || '',
          certsDir: this.normalizeCertsDir(e.certsDir) ?? '',
        };
      }),
    };
    await this.prisma.systemSetting.upsert({
      where: { key: 'DEPLOYMENT_ENVS' },
      create: { key: 'DEPLOYMENT_ENVS', value: next },
      update: { value: next },
      select: { id: true },
    });
    return this.getEnvs();
  }

  private normalizeWebhookBaseUrl(url?: string): string | null {
    const raw = (url ?? '').trim().replace(/\/$/, '');
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) return null;
    return raw;
  }

  buildNotifyUrls(env: DeploymentEnv): {
    wechatPayNotifyUrl: string | null;
    wechatRefundNotifyUrl: string | null;
    alipayPayNotifyUrl: string | null;
    alipayRefundNotifyUrl: string | null;
  } {
    const base = this.normalizeWebhookBaseUrl(
      env.webhookBaseUrl || env.apiBaseUrl,
    );
    if (!base) {
      return {
        wechatPayNotifyUrl: null,
        wechatRefundNotifyUrl: null,
        alipayPayNotifyUrl: null,
        alipayRefundNotifyUrl: null,
      };
    }
    return {
      wechatPayNotifyUrl: `${base}/api/payments/wechat/notify`,
      wechatRefundNotifyUrl: `${base}/api/payment/notify/wechat/refund`,
      alipayPayNotifyUrl: `${base}/api/payment/notify/alipay`,
      alipayRefundNotifyUrl: `${base}/api/payment/notify/alipay/refund`,
    };
  }

  buildDockerPaymentPathExamples(env: DeploymentEnv): {
    wechatPrivateKeyPathExample: string | null;
    alipayPrivateKeyPathExample: string | null;
    alipayPublicKeyPathExample: string | null;
  } {
    const dir = this.normalizeCertsDir(env.certsDir);
    if (!dir) {
      return {
        wechatPrivateKeyPathExample: null,
        alipayPrivateKeyPathExample: null,
        alipayPublicKeyPathExample: null,
      };
    }
    return {
      wechatPrivateKeyPathExample: `${dir}/wechat/apiclient_key.pem`,
      alipayPrivateKeyPathExample: `${dir}/alipay/app_private_key.pem`,
      alipayPublicKeyPathExample: `${dir}/alipay/alipay_public_key.pem`,
    };
  }

  async listRecords(): Promise<DeploymentRecord[]> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'DEPLOYMENT_RECORDS' },
      select: { value: true },
    });
    const raw = asRecord(row?.value);
    const items = asArray(raw['items']).map((x) => {
      const r = asRecord(x);
      return {
        id: asString(r['id']) ?? '',
        env: asString(r['env']) ?? '',
        version: asString(r['version']) ?? '',
        image: asString(r['image']) || undefined,
        commit: asString(r['commit']),
        notes: asString(r['notes']),
        operatorId: asString(r['operatorId']) ?? '',
        createdAt: asString(r['createdAt']) ?? '',
      } satisfies DeploymentRecord;
    });
    return items.filter((x) => x.id && x.env && x.version && x.createdAt);
  }

  async createRecord(
    dto: CreateDeploymentRecordDto,
    operatorId: string,
  ): Promise<DeploymentRecord[]> {
    const current = await this.listRecords();
    const next: DeploymentRecord = {
      id: crypto.randomUUID(),
      env: dto.env,
      version: dto.version.trim(),
      image: dto.image?.trim() || undefined,
      commit: dto.commit?.trim() || undefined,
      notes: dto.notes?.trim() || undefined,
      operatorId,
      createdAt: new Date().toISOString(),
    };
    const merged = [next, ...current].slice(0, 200);
    await this.prisma.systemSetting.upsert({
      where: { key: 'DEPLOYMENT_RECORDS' },
      create: {
        key: 'DEPLOYMENT_RECORDS',
        value: { items: merged },
      },
      update: { value: { items: merged } },
      select: { id: true },
    });
    return this.listRecords();
  }

  async deleteRecord(id: string): Promise<DeploymentRecord[]> {
    const current = await this.listRecords();
    const merged = current.filter((x) => x.id !== id);
    await this.prisma.systemSetting.upsert({
      where: { key: 'DEPLOYMENT_RECORDS' },
      create: {
        key: 'DEPLOYMENT_RECORDS',
        value: { items: merged },
      },
      update: { value: { items: merged } },
      select: { id: true },
    });
    return this.listRecords();
  }
}
