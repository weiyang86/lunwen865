'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { BusinessHours, Store, StoreUpsertPayload } from '@/types/admin/store';
import { createStore, fetchStore, updateStore } from '@/services/admin/stores';
import { StoreBusinessHoursField } from './store-business-hours-field';

type Mode = 'create' | 'edit' | 'view';

interface Props {
  open: boolean;
  mode: Mode;
  storeId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function emptyBusinessHours(): BusinessHours {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function parseTimeToMinutes(t: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function isPhone(s: string) {
  const v = s.trim();
  if (!v) return true;
  const mobile = /^1\d{10}$/;
  const landline = /^0\d{2,3}-?\d{7,8}$/;
  return mobile.test(v) || landline.test(v);
}

function isMobile(s: string) {
  const v = s.trim();
  if (!v) return true;
  return /^1\d{10}$/.test(v);
}

function validateBusinessHours(hours: BusinessHours): string | null {
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const slots = hours[d] ?? [];
    if (slots.length > 3) return '营业时间每日至多 3 段';
    const normalized = slots
      .map((s) => ({
        open: s.open,
        close: s.close,
        o: parseTimeToMinutes(s.open),
        c: parseTimeToMinutes(s.close),
      }))
      .sort((a, b) => (a.o ?? 0) - (b.o ?? 0));

    for (const s of normalized) {
      if (s.o == null || s.c == null) return '营业时间格式必须为 HH:mm';
      if (s.o >= s.c) return '营业时间开始必须早于结束';
    }

    for (let i = 1; i < normalized.length; i++) {
      const prev = normalized[i - 1];
      const curr = normalized[i];
      if ((prev.c ?? 0) > (curr.o ?? 0)) return '同一天多个时间段不可重叠';
    }
  }
  return null;
}

export function StoreFormDrawer({ open, mode, storeId, onClose, onSaved }: Props) {
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [store, setStore] = useState<Store | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [longitude, setLongitude] = useState('');
  const [latitude, setLatitude] = useState('');
  const [description, setDescription] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [businessHours, setBusinessHours] = useState<BusinessHours>(emptyBusinessHours());

  const [errors, setErrors] = useState<Record<string, string>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);

  const readOnly = mode === 'view';
  const canClose = !submitting;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setStore(null);
    if (mode === 'create') {
      setDetailLoading(false);
      setName('');
      setCode('');
      setPhone('');
      setAddress('');
      setLongitude('');
      setLatitude('');
      setDescription('');
      setManagerName('');
      setManagerPhone('');
      setBusinessHours(emptyBusinessHours());
      return;
    }
    if (!storeId) return;
    let cancelled = false;
    setDetailLoading(true);
    fetchStore(storeId)
      .then((d) => {
        if (cancelled) return;
        setStore(d);
        setName(d.name ?? '');
        setCode(d.code ?? '');
        setPhone(d.phone ?? '');
        setAddress(d.address ?? '');
        setLongitude(d.longitude == null ? '' : String(d.longitude));
        setLatitude(d.latitude == null ? '' : String(d.latitude));
        setDescription(d.description ?? '');
        setManagerName(d.managerName ?? '');
        setManagerPhone(d.managerPhone ?? '');
        setBusinessHours(d.businessHours ?? emptyBusinessHours());
      })
      .catch((e: unknown) => {
        void e;
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, storeId]);

  const title = useMemo(() => {
    if (mode === 'create') return '新增门店';
    if (mode === 'edit') return '编辑门店';
    return '查看门店';
  }, [mode]);

  function scrollToField(key: string) {
    const el = rootRef.current?.querySelector(`[data-field="${key}"]`);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const n = name.trim();
    const c = code.trim();
    const addr = address.trim();

    if (n.length < 2 || n.length > 30) next.name = '门店名称需为 2-30 字';
    if (!c) next.code = '门店编码必填';
    else if (!/^[A-Za-z0-9_]{3,20}$/.test(c)) next.code = '编码需为 3-20 位字母数字下划线';
    if (!addr) next.address = '详细地址必填';
    if (!isPhone(phone)) next.phone = '联系电话格式不正确';
    if (description.trim().length > 200) next.description = '描述最多 200 字';
    if (managerName.trim() && (managerName.trim().length < 2 || managerName.trim().length > 20)) {
      next.managerName = '店长姓名需为 2-20 字';
    }
    if (!isMobile(managerPhone)) next.managerPhone = '店长电话格式不正确';

    const lon = longitude.trim();
    const lat = latitude.trim();
    if (lon) {
      const v = Number(lon);
      if (!Number.isFinite(v) || v < -180 || v > 180) next.longitude = '经度范围 -180 ~ 180';
    }
    if (lat) {
      const v = Number(lat);
      if (!Number.isFinite(v) || v < -90 || v > 90) next.latitude = '纬度范围 -90 ~ 90';
    }

    const bhErr = validateBusinessHours(businessHours);
    if (bhErr) next.businessHours = bhErr;

    return next;
  }

  async function handleSubmit() {
    const nextErrors = validate();
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      scrollToField(first);
      return;
    }

    const payload: StoreUpsertPayload = {
      name: name.trim(),
      code: code.trim(),
      address: address.trim(),
      businessHours,
    };

    const p = phone.trim();
    if (p) payload.phone = p;

    const desc = description.trim();
    if (desc) payload.description = desc;

    const mn = managerName.trim();
    if (mn) payload.managerName = mn;

    const mp = managerPhone.trim();
    if (mp) payload.managerPhone = mp;

    const lon = longitude.trim();
    if (lon) payload.longitude = Number(lon);

    const lat = latitude.trim();
    if (lat) payload.latitude = Number(lat);

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createStore(payload);
        toast.success('门店已创建');
      } else if (mode === 'edit' && storeId) {
        await updateStore(storeId, payload);
        toast.success('已保存');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      void e;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v && canClose) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col p-0 shadow-xl sm:max-w-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-6">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            {mode !== 'create' && store ? (
              <div className="mt-1 truncate font-mono text-xs text-slate-500">
                {store.code}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => (canClose ? onClose() : null)}
            disabled={!canClose}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={rootRef} className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {detailLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 text-base font-semibold text-slate-900">基本信息</div>

                <div className="space-y-4">
                  <div data-field="name" className="space-y-1">
                    <div className="text-sm font-medium text-slate-700">
                      门店名称 <span className="text-rose-500">*</span>
                    </div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={readOnly}
                      className={cn(
                        'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                        'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                      )}
                    />
                    {errors.name ? (
                      <div className="text-xs text-rose-600">{errors.name}</div>
                    ) : null}
                  </div>

                  <div data-field="code" className="space-y-1">
                    <div className="text-sm font-medium text-slate-700">
                      门店编码 <span className="text-rose-500">*</span>
                    </div>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={readOnly || mode === 'edit'}
                      className={cn(
                        'h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-mono text-sm outline-none',
                        'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                        readOnly || mode === 'edit' ? 'bg-slate-50 text-slate-500' : '',
                      )}
                    />
                    {errors.code ? (
                      <div className="text-xs text-rose-600">{errors.code}</div>
                    ) : null}
                    {mode === 'edit' ? (
                      <div className="text-xs text-slate-400">编码创建后不可修改</div>
                    ) : null}
                  </div>

                  <div data-field="phone" className="space-y-1">
                    <div className="text-sm font-medium text-slate-700">联系电话</div>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={readOnly}
                      className={cn(
                        'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                        'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                      )}
                    />
                    {errors.phone ? (
                      <div className="text-xs text-rose-600">{errors.phone}</div>
                    ) : null}
                  </div>

                  <div data-field="description" className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-700">描述</div>
                      <div className="text-xs text-slate-400">
                        {description.length}/200
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={200}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={readOnly}
                      className={cn(
                        'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none',
                        'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                      )}
                    />
                    {errors.description ? (
                      <div className="text-xs text-rose-600">{errors.description}</div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 text-base font-semibold text-slate-900">地址与坐标</div>
                <div className="space-y-4">
                  <div data-field="address" className="space-y-1">
                    <div className="text-sm font-medium text-slate-700">
                      详细地址 <span className="text-rose-500">*</span>
                    </div>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={readOnly}
                      className={cn(
                        'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                        'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                      )}
                    />
                    {errors.address ? (
                      <div className="text-xs text-rose-600">{errors.address}</div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div data-field="longitude" className="space-y-1">
                      <div className="text-sm font-medium text-slate-700">经度</div>
                      <input
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        disabled={readOnly}
                        inputMode="decimal"
                        className={cn(
                          'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                          'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                        )}
                      />
                      {errors.longitude ? (
                        <div className="text-xs text-rose-600">{errors.longitude}</div>
                      ) : null}
                    </div>
                    <div data-field="latitude" className="space-y-1">
                      <div className="text-sm font-medium text-slate-700">纬度</div>
                      <input
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        disabled={readOnly}
                        inputMode="decimal"
                        className={cn(
                          'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                          'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                        )}
                      />
                      {errors.latitude ? (
                        <div className="text-xs text-rose-600">{errors.latitude}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 text-base font-semibold text-slate-900">营业时间</div>
                <div data-field="businessHours" className="space-y-2">
                  <StoreBusinessHoursField
                    value={businessHours}
                    onChange={setBusinessHours}
                    disabled={readOnly}
                  />
                  {errors.businessHours ? (
                    <div className="text-xs text-rose-600">{errors.businessHours}</div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 text-base font-semibold text-slate-900">店长信息</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div data-field="managerName" className="space-y-1">
                    <div className="text-sm font-medium text-slate-700">店长姓名</div>
                    <input
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      disabled={readOnly}
                      className={cn(
                        'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                        'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                      )}
                    />
                    {errors.managerName ? (
                      <div className="text-xs text-rose-600">{errors.managerName}</div>
                    ) : null}
                  </div>
                  <div data-field="managerPhone" className="space-y-1">
                    <div className="text-sm font-medium text-slate-700">店长电话</div>
                    <input
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      disabled={readOnly}
                      className={cn(
                        'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                        'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                      )}
                    />
                    {errors.managerPhone ? (
                      <div className="text-xs text-rose-600">{errors.managerPhone}</div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {readOnly ? null : (
          <div className="border-t border-slate-200 bg-white p-4">
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    提交中…
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
