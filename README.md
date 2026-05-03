# My App

## 用户认证模块

### 模块说明

- 基于 JWT 的 Access Token + Refresh Token（支持旋转）
- 全局鉴权守卫默认生效，需通过 `@Public()` 放行公开接口
- 角色权限通过 `@Roles(...)` + `RolesGuard` 实现，`SUPER_ADMIN` 拥有全部权限

### 路由清单（共 25 个）

Base：`/api`

Auth（11）

- `POST /api/auth/send-code`
- `POST /api/auth/register`
- `POST /api/auth/login/phone-code`
- `POST /api/auth/login/phone-password`
- `POST /api/auth/login/email`
- `POST /api/auth/login/wechat`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`

Users（6）

- `GET /api/users/me`
- `PATCH /api/users/me`
- `POST /api/users/me/bind-phone`
- `POST /api/users/me/bind-email`
- `GET /api/users/me/login-logs`
- `GET /api/users/me/quota`

Admin Users（8）

- `GET /api/admin/users`
- `GET /api/admin/users/stats/overview`
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id`
- `POST /api/admin/users/:id/ban`
- `POST /api/admin/users/:id/unban`
- `POST /api/admin/users/:id/grant-quota`
- `POST /api/admin/users/:id/reset-password`

### 鉴权方式说明

- Access Token：`Authorization: Bearer <accessToken>`
- Refresh Token：用于换新 Access/Refresh（旋转后旧 refreshToken 不可重用）

### 装饰器用法示例

```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';
import { Roles } from './modules/auth/decorators/roles.decorator';
import { CurrentUser } from './modules/auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('demo')
export class DemoController {
  @Public()
  @Get('ping')
  ping() {
    return { ok: true };
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin-only')
  adminOnly(@CurrentUser('id') userId: string) {
    return { userId };
  }
}
```

### 默认管理员账号

- `phone`: `13800000000`
- `password`: `Admin@123456`
- `role`: `SUPER_ADMIN`

### 注意事项

- 短信验证码默认 `SMS_PROVIDER=mock`：验证码打印在服务端控制台
- 微信登录为 mock：`openId = mock_${code}`

## 支付证书文件

生产环境需要将官方下发的证书文件放到 `certs/` 对应目录，文件名需与环境变量配置一致：

- `certs/wechat/apiclient_key.pem`（对应 `WECHAT_PAY_PRIVATE_KEY_PATH`）
- `certs/alipay/app_private_key.pem`（对应 `ALIPAY_PRIVATE_KEY_PATH`）
- `certs/alipay/alipay_public_key.pem`（对应 `ALIPAY_PUBLIC_KEY_PATH`）

## 商品种子数据

```bash
pnpm tsx prisma/seeds/products.seed.ts
```

## 支付模块文档

- 详见 [docs/payment.md](./docs/payment.md)
