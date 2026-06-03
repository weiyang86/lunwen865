import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canShowMockPay,
  formatRemainingSeconds,
  getDefaultWechatMethod,
  isExpiredPaymentStatus,
  isPaidPaymentStatus,
  normalizePaymentStatus,
  readPaymentJumpUrl,
  readPaymentQrValue,
  safeClientRedirectUrl,
} from './payment-ui';

test('普通用户看不到 mock 支付入口，管理员且开关开启才可见', () => {
  assert.equal(canShowMockPay({ role: 'USER', enableMockPay: 'true' }), false);
  assert.equal(canShowMockPay({ role: 'ADMIN', enableMockPay: 'false' }), false);
  assert.equal(canShowMockPay({ role: 'ADMIN', enableMockPay: 'true' }), true);
});

test('默认微信支付方式按浏览器 UA 区分 PC Native 与移动 H5', () => {
  assert.equal(getDefaultWechatMethod('Mozilla/5.0 Macintosh'), 'WECHAT_NATIVE');
  assert.equal(getDefaultWechatMethod('Mozilla/5.0 iPhone Mobile'), 'WECHAT_H5');
});

test('Native 二维码与 H5 跳转链接兼容微信字段别名', () => {
  assert.equal(readPaymentQrValue({ code_url: 'weixin://wxpay/bizpayurl' }), 'weixin://wxpay/bizpayurl');
  assert.equal(readPaymentJumpUrl({ mweb_url: 'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb' }), 'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb');
});

test('支付状态 paid 后按后端 redirectUrl 优先跳转且拒绝外部 URL', () => {
  assert.equal(isPaidPaymentStatus({ orderId: 'o1', paid: true }), true);
  assert.equal(safeClientRedirectUrl({ redirectUrl: '/tasks?taskId=t1' }), '/tasks?taskId=t1');
  assert.equal(safeClientRedirectUrl({ redirectUrl: 'https://evil.example', taskId: 't1' }), '/tasks?taskId=t1');
  assert.equal(safeClientRedirectUrl({ redirectUrl: '//evil.example' }), '/account');
});


test('支付状态判断兼容大小写并识别过期倒计时', () => {
  assert.equal(normalizePaymentStatus(' pending_payment '), 'PENDING_PAYMENT');
  assert.equal(isPaidPaymentStatus({ orderId: 'o1', paymentStatus: 'succeeded' }), true);
  assert.equal(isExpiredPaymentStatus({ orderId: 'o1', orderStatus: 'expired' }), true);
  assert.equal(isExpiredPaymentStatus({ orderId: 'o1', remainingSeconds: 0, paid: false }), true);
  assert.equal(formatRemainingSeconds(599), '09:59');
});
