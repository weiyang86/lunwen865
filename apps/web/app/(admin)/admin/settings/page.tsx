'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminHttp } from '@/lib/admin/api-client';

type PaymentSettings = {
  sandbox: boolean;
  orderExpireMinutes: number;
  wechat: {
    notifyUrl: string;
    appid: string;
    mchid: string;
    serialNo: string;
    privateKeyPath: string;
    apiV3KeyConfigured: boolean;
  };
  alipay: {
    notifyUrl: string;
    returnUrl: string;
    appId: string;
    gateway: string;
    privateKeyPath: string;
    publicKeyPath: string;
  };
};

type SiteSettings = {
  siteName: string;
  siteUrl: string;
  logoUrl: string;
  supportEmail: string;
  registerGift: { paperGeneration: number; polish: number; export: number };
  exchangeRates: { paperGeneration: number; polish: number; export: number; aiChat: number };
};

type SettingsResp = { payment: PaymentSettings; site: SiteSettings };

function toNonNegativeInt(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

function toPositiveInt(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payment, setPayment] = useState<PaymentSettings | null>(null);
  const [site, setSite] = useState<SiteSettings | null>(null);

  const [savingPayment, setSavingPayment] = useState(false);
  const [savingSite, setSavingSite] = useState(false);

  const paymentForm = useMemo(() => {
    if (!payment) return null;
    return {
      sandbox: payment.sandbox,
      orderExpireMinutes: String(payment.orderExpireMinutes ?? 30),
      wechatNotifyUrl: payment.wechat?.notifyUrl ?? '',
      wechatAppid: payment.wechat?.appid ?? '',
      wechatMchid: payment.wechat?.mchid ?? '',
      wechatSerialNo: payment.wechat?.serialNo ?? '',
      wechatPrivateKeyPath: payment.wechat?.privateKeyPath ?? '',
      wechatApiV3Key: '',
      alipayNotifyUrl: payment.alipay?.notifyUrl ?? '',
      alipayReturnUrl: payment.alipay?.returnUrl ?? '',
      alipayAppId: payment.alipay?.appId ?? '',
      alipayGateway: payment.alipay?.gateway ?? '',
      alipayPrivateKeyPath: payment.alipay?.privateKeyPath ?? '',
      alipayPublicKeyPath: payment.alipay?.publicKeyPath ?? '',
    };
  }, [payment]);

  const siteForm = useMemo(() => {
    if (!site) return null;
    return {
      siteName: site.siteName ?? '',
      siteUrl: site.siteUrl ?? '',
      logoUrl: site.logoUrl ?? '',
      supportEmail: site.supportEmail ?? '',
      registerGiftPaperGeneration: String(site.registerGift?.paperGeneration ?? 0),
      registerGiftPolish: String(site.registerGift?.polish ?? 0),
      registerGiftExport: String(site.registerGift?.export ?? 0),
      exchangeRatePaperGeneration: String(site.exchangeRates?.paperGeneration ?? 1),
      exchangeRatePolish: String(site.exchangeRates?.polish ?? 1),
      exchangeRateExport: String(site.exchangeRates?.export ?? 1),
      exchangeRateAiChat: String(site.exchangeRates?.aiChat ?? 1),
    };
  }, [site]);

  const [paymentDraft, setPaymentDraft] = useState<NonNullable<typeof paymentForm> | null>(null);
  const [siteDraft, setSiteDraft] = useState<NonNullable<typeof siteForm> | null>(null);

  useEffect(() => {
    if (paymentForm) setPaymentDraft(paymentForm);
  }, [paymentForm]);
  useEffect(() => {
    if (siteForm) setSiteDraft(siteForm);
  }, [siteForm]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminHttp.get<SettingsResp>('/admin/settings');
      setPayment(data.payment);
      setSite(data.site);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function savePayment() {
    if (!paymentDraft) return;
    if (savingPayment) return;

    const orderExpireMinutes = toPositiveInt(paymentDraft.orderExpireMinutes);
    if (!orderExpireMinutes) {
      toast.error('支付超时分钟数必须为正整数');
      return;
    }

    try {
      setSavingPayment(true);
      const updated = await adminHttp.put<PaymentSettings>('/admin/settings/payment', {
        sandbox: paymentDraft.sandbox,
        orderExpireMinutes,
        wechatNotifyUrl: paymentDraft.wechatNotifyUrl,
        wechatAppid: paymentDraft.wechatAppid,
        wechatMchid: paymentDraft.wechatMchid,
        wechatSerialNo: paymentDraft.wechatSerialNo,
        wechatPrivateKeyPath: paymentDraft.wechatPrivateKeyPath,
        wechatApiV3Key: paymentDraft.wechatApiV3Key,
        alipayNotifyUrl: paymentDraft.alipayNotifyUrl,
        alipayReturnUrl: paymentDraft.alipayReturnUrl,
        alipayAppId: paymentDraft.alipayAppId,
        alipayGateway: paymentDraft.alipayGateway,
        alipayPrivateKeyPath: paymentDraft.alipayPrivateKeyPath,
        alipayPublicKeyPath: paymentDraft.alipayPublicKeyPath,
      });
      setPayment(updated);
      toast.success('支付设置已保存');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingPayment(false);
    }
  }

  async function saveSite() {
    if (!siteDraft) return;
    if (savingSite) return;
    const registerGiftPaperGeneration = toNonNegativeInt(
      siteDraft.registerGiftPaperGeneration,
    );
    if (registerGiftPaperGeneration == null) {
      toast.error('注册赠送（论文生成）必须为非负整数');
      return;
    }
    const registerGiftPolish = toNonNegativeInt(siteDraft.registerGiftPolish);
    if (registerGiftPolish == null) {
      toast.error('注册赠送（润色）必须为非负整数');
      return;
    }
    const registerGiftExport = toNonNegativeInt(siteDraft.registerGiftExport);
    if (registerGiftExport == null) {
      toast.error('注册赠送（导出）必须为非负整数');
      return;
    }

    const exchangeRatePaperGeneration = toPositiveInt(
      siteDraft.exchangeRatePaperGeneration,
    );
    if (exchangeRatePaperGeneration == null) {
      toast.error('兑换比例（论文生成）必须为正整数');
      return;
    }
    const exchangeRatePolish = toPositiveInt(siteDraft.exchangeRatePolish);
    if (exchangeRatePolish == null) {
      toast.error('兑换比例（润色）必须为正整数');
      return;
    }
    const exchangeRateExport = toPositiveInt(siteDraft.exchangeRateExport);
    if (exchangeRateExport == null) {
      toast.error('兑换比例（导出）必须为正整数');
      return;
    }
    const exchangeRateAiChat = toPositiveInt(siteDraft.exchangeRateAiChat);
    if (exchangeRateAiChat == null) {
      toast.error('兑换比例（AI 对话）必须为正整数');
      return;
    }
    try {
      setSavingSite(true);
      const updated = await adminHttp.put<SiteSettings>('/admin/settings/site', {
        siteName: siteDraft.siteName,
        siteUrl: siteDraft.siteUrl,
        logoUrl: siteDraft.logoUrl,
        supportEmail: siteDraft.supportEmail,
        registerGiftPaperGeneration,
        registerGiftPolish,
        registerGiftExport,
        exchangeRatePaperGeneration,
        exchangeRatePolish,
        exchangeRateExport,
        exchangeRateAiChat,
      });
      setSite(updated);
      toast.success('站点参数已保存');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingSite(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">后台参数设置</h1>
          <p className="text-sm text-slate-500">配置支付、站点等后台运行参数。</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          刷新
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <Tabs defaultValue="payment">
          <TabsList variant="line">
            <TabsTrigger value="payment">支付设置</TabsTrigger>
            <TabsTrigger value="site">网站站点参数</TabsTrigger>
          </TabsList>

          <TabsContent value="payment" className="mt-4">
            {loading || !paymentDraft ? (
              <div className="text-sm text-slate-500">加载中...</div>
            ) : (
              <div className="grid gap-4">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">沙箱模式</div>
                    <div className="mt-1 text-xs text-slate-500">
                      开启后可在前端使用“沙箱支付”，便于本地联调。
                    </div>
                  </div>
                  <Switch
                    checked={paymentDraft.sandbox}
                    onCheckedChange={(v) =>
                      setPaymentDraft((prev) => (prev ? { ...prev, sandbox: v } : prev))
                    }
                    disabled={savingPayment}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="order-expire">订单支付超时（分钟）</Label>
                    <Input
                      id="order-expire"
                      inputMode="numeric"
                      value={paymentDraft.orderExpireMinutes}
                      onChange={(e) =>
                        setPaymentDraft((prev) =>
                          prev ? { ...prev, orderExpireMinutes: e.target.value } : prev,
                        )
                      }
                      disabled={savingPayment}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <Tabs defaultValue="wechat">
                    <TabsList variant="line">
                      <TabsTrigger value="wechat">微信支付</TabsTrigger>
                      <TabsTrigger value="alipay">支付宝支付</TabsTrigger>
                    </TabsList>

                    <TabsContent value="wechat" className="mt-4">
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="wechat-notify">支付回调地址（notifyUrl）</Label>
                          <Input
                            id="wechat-notify"
                            value={paymentDraft.wechatNotifyUrl}
                            onChange={(e) =>
                              setPaymentDraft((prev) =>
                                prev ? { ...prev, wechatNotifyUrl: e.target.value } : prev,
                              )
                            }
                            placeholder="https://<domain>/api/payment/notify/wechat"
                            disabled={savingPayment}
                          />
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">
                            SDK 参数（wechatpay-node-v3）
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                              <Label htmlFor="wechat-appid">AppID</Label>
                              <Input
                                id="wechat-appid"
                                value={paymentDraft.wechatAppid}
                                onChange={(e) =>
                                  setPaymentDraft((prev) =>
                                    prev ? { ...prev, wechatAppid: e.target.value } : prev,
                                  )
                                }
                                disabled={savingPayment}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="wechat-mchid">商户号（MCHID）</Label>
                              <Input
                                id="wechat-mchid"
                                value={paymentDraft.wechatMchid}
                                onChange={(e) =>
                                  setPaymentDraft((prev) =>
                                    prev ? { ...prev, wechatMchid: e.target.value } : prev,
                                  )
                                }
                                disabled={savingPayment}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="wechat-serial">证书序列号（SerialNo）</Label>
                              <Input
                                id="wechat-serial"
                                value={paymentDraft.wechatSerialNo}
                                onChange={(e) =>
                                  setPaymentDraft((prev) =>
                                    prev ? { ...prev, wechatSerialNo: e.target.value } : prev,
                                  )
                                }
                                disabled={savingPayment}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="wechat-private-key-path">私钥文件路径（PrivateKeyPath）</Label>
                              <Input
                                id="wechat-private-key-path"
                                value={paymentDraft.wechatPrivateKeyPath}
                                onChange={(e) =>
                                  setPaymentDraft((prev) =>
                                    prev
                                      ? { ...prev, wechatPrivateKeyPath: e.target.value }
                                      : prev,
                                  )
                                }
                                placeholder="./certs/wechat/apiclient_key.pem"
                                disabled={savingPayment}
                              />
                            </div>
                          </div>
                          <div className="mt-4 grid gap-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="wechat-apiv3">API V3 Key（敏感）</Label>
                              <div className="text-xs text-slate-500">
                                {payment?.wechat.apiV3KeyConfigured ? '已配置' : '未配置'}
                              </div>
                            </div>
                            <Input
                              id="wechat-apiv3"
                              type="password"
                              value={paymentDraft.wechatApiV3Key}
                              onChange={(e) =>
                                setPaymentDraft((prev) =>
                                  prev ? { ...prev, wechatApiV3Key: e.target.value } : prev,
                                )
                              }
                              placeholder="留空不修改；输入新值将覆盖"
                              disabled={savingPayment}
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="alipay" className="mt-4">
                      <div className="grid gap-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label htmlFor="alipay-notify">支付回调地址（notifyUrl）</Label>
                            <Input
                              id="alipay-notify"
                              value={paymentDraft.alipayNotifyUrl}
                              onChange={(e) =>
                                setPaymentDraft((prev) =>
                                  prev ? { ...prev, alipayNotifyUrl: e.target.value } : prev,
                                )
                              }
                              placeholder="https://<domain>/api/payment/notify/alipay"
                              disabled={savingPayment}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="alipay-return">同步跳转地址（returnUrl，可选）</Label>
                            <Input
                              id="alipay-return"
                              value={paymentDraft.alipayReturnUrl}
                              onChange={(e) =>
                                setPaymentDraft((prev) =>
                                  prev ? { ...prev, alipayReturnUrl: e.target.value } : prev,
                                )
                              }
                              placeholder="https://<domain>/orders"
                              disabled={savingPayment}
                            />
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">
                            SDK 参数（alipay-sdk）
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                              <Label htmlFor="alipay-appid">AppID</Label>
                              <Input
                                id="alipay-appid"
                                value={paymentDraft.alipayAppId}
                                onChange={(e) =>
                                  setPaymentDraft((prev) =>
                                    prev ? { ...prev, alipayAppId: e.target.value } : prev,
                                  )
                                }
                                disabled={savingPayment}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="alipay-gateway">Gateway</Label>
                              <Input
                                id="alipay-gateway"
                                value={paymentDraft.alipayGateway}
                                onChange={(e) =>
                                  setPaymentDraft((prev) =>
                                    prev ? { ...prev, alipayGateway: e.target.value } : prev,
                                  )
                                }
                                placeholder="https://openapi.alipay.com/gateway.do"
                                disabled={savingPayment}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="alipay-private-key-path">应用私钥路径（PrivateKeyPath）</Label>
                              <Input
                                id="alipay-private-key-path"
                                value={paymentDraft.alipayPrivateKeyPath}
                                onChange={(e) =>
                                  setPaymentDraft((prev) =>
                                    prev
                                      ? { ...prev, alipayPrivateKeyPath: e.target.value }
                                      : prev,
                                  )
                                }
                                placeholder="./certs/alipay/app_private_key.pem"
                                disabled={savingPayment}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="alipay-public-key-path">支付宝公钥路径（PublicKeyPath）</Label>
                              <Input
                                id="alipay-public-key-path"
                                value={paymentDraft.alipayPublicKeyPath}
                                onChange={(e) =>
                                  setPaymentDraft((prev) =>
                                    prev
                                      ? { ...prev, alipayPublicKeyPath: e.target.value }
                                      : prev,
                                  )
                                }
                                placeholder="./certs/alipay/alipay_public_key.pem"
                                disabled={savingPayment}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => void savePayment()} disabled={savingPayment}>
                    {savingPayment ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="site" className="mt-4">
            {loading || !siteDraft ? (
              <div className="text-sm text-slate-500">加载中...</div>
            ) : (
              <div className="grid gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="site-name">站点名称</Label>
                    <Input
                      id="site-name"
                      value={siteDraft.siteName}
                      onChange={(e) =>
                        setSiteDraft((prev) =>
                          prev ? { ...prev, siteName: e.target.value } : prev,
                        )
                      }
                      disabled={savingSite}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-url">站点地址</Label>
                    <Input
                      id="site-url"
                      value={siteDraft.siteUrl}
                      onChange={(e) =>
                        setSiteDraft((prev) =>
                          prev ? { ...prev, siteUrl: e.target.value } : prev,
                        )
                      }
                      placeholder="https://..."
                      disabled={savingSite}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="logo-url">Logo URL（可选）</Label>
                    <Input
                      id="logo-url"
                      value={siteDraft.logoUrl}
                      onChange={(e) =>
                        setSiteDraft((prev) =>
                          prev ? { ...prev, logoUrl: e.target.value } : prev,
                        )
                      }
                      placeholder="https://..."
                      disabled={savingSite}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="support-email">支持邮箱（可选）</Label>
                    <Input
                      id="support-email"
                      value={siteDraft.supportEmail}
                      onChange={(e) =>
                        setSiteDraft((prev) =>
                          prev ? { ...prev, supportEmail: e.target.value } : prev,
                        )
                      }
                      placeholder="support@example.com"
                      disabled={savingSite}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">新用户福利（注册赠送）</div>
                  <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="gift-paper">论文生成</Label>
                      <Input
                        id="gift-paper"
                        inputMode="numeric"
                        value={siteDraft.registerGiftPaperGeneration}
                        onChange={(e) =>
                          setSiteDraft((prev) =>
                            prev
                              ? { ...prev, registerGiftPaperGeneration: e.target.value }
                              : prev,
                          )
                        }
                        disabled={savingSite}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gift-polish">润色</Label>
                      <Input
                        id="gift-polish"
                        inputMode="numeric"
                        value={siteDraft.registerGiftPolish}
                        onChange={(e) =>
                          setSiteDraft((prev) =>
                            prev ? { ...prev, registerGiftPolish: e.target.value } : prev,
                          )
                        }
                        disabled={savingSite}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gift-export">导出</Label>
                      <Input
                        id="gift-export"
                        inputMode="numeric"
                        value={siteDraft.registerGiftExport}
                        onChange={(e) =>
                          setSiteDraft((prev) =>
                            prev ? { ...prev, registerGiftExport: e.target.value } : prev,
                          )
                        }
                        disabled={savingSite}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">脑细胞兑换比例</div>
                  <div className="mt-1 text-xs text-slate-500">
                    表示兑换 1 次服务需要多少脑细胞。
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="grid gap-2">
                      <Label htmlFor="rate-paper">论文生成</Label>
                      <Input
                        id="rate-paper"
                        inputMode="numeric"
                        value={siteDraft.exchangeRatePaperGeneration}
                        onChange={(e) =>
                          setSiteDraft((prev) =>
                            prev
                              ? { ...prev, exchangeRatePaperGeneration: e.target.value }
                              : prev,
                          )
                        }
                        disabled={savingSite}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rate-polish">润色</Label>
                      <Input
                        id="rate-polish"
                        inputMode="numeric"
                        value={siteDraft.exchangeRatePolish}
                        onChange={(e) =>
                          setSiteDraft((prev) =>
                            prev ? { ...prev, exchangeRatePolish: e.target.value } : prev,
                          )
                        }
                        disabled={savingSite}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rate-export">导出</Label>
                      <Input
                        id="rate-export"
                        inputMode="numeric"
                        value={siteDraft.exchangeRateExport}
                        onChange={(e) =>
                          setSiteDraft((prev) =>
                            prev ? { ...prev, exchangeRateExport: e.target.value } : prev,
                          )
                        }
                        disabled={savingSite}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rate-chat">AI 对话</Label>
                      <Input
                        id="rate-chat"
                        inputMode="numeric"
                        value={siteDraft.exchangeRateAiChat}
                        onChange={(e) =>
                          setSiteDraft((prev) =>
                            prev ? { ...prev, exchangeRateAiChat: e.target.value } : prev,
                          )
                        }
                        disabled={savingSite}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => void saveSite()} disabled={savingSite}>
                    {savingSite ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
