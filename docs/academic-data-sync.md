# 学术基础数据同步设计

## 1. 地区数据同步范围

AcademicData-01 首期实现地区基础数据同步，数据源为高德行政区域 API，接口使用 `subdistrict=3` 一次获取全国省、市、区县层级。同步结果写入 `academic_regions`，作为后续高校数据 `provinceCode`、`cityCode` 匹配依据。

## 2. 为什么使用 adcode 作为 provinceCode / cityCode

高德行政区域 API 的 `adcode` 与国内行政区划编码体系一致性较好，且省、市、区县均有稳定编码。因此系统统一把 `adcode` 保存为 `AcademicRegion.code`：

- 省级节点：作为 `provinceCode`，例如重庆市 `500000`。
- 市级节点：作为 `cityCode`，例如重庆城区 `500100`。
- 区县节点：作为后续区县筛选与地址补充能力。

这样可以避免使用名称匹配导致的重名、简称、改名问题，并为高校数据导入提供可追溯的标准编码。

## 3. 高德 API Key 配置方式

后端读取环境变量：

```bash
AMAP_WEB_SERVICE_KEY=
```

注意：不要把真实 Key 提交到仓库。未配置 `AMAP_WEB_SERVICE_KEY` 且未开启 mock 时，预览和确认接口会返回明确错误提示。

本地或测试环境可开启 mock：

```bash
ACADEMIC_REGION_SYNC_MOCK=true
```

mock 模式不依赖真实高德 API，内置重庆、四川等少量省市区样例，用于单元测试、联调和本地验收。

## 4. 同步流程：preview -> confirm -> upsert

1. 管理员进入 `/admin/academic/sync`。
2. 点击“预览同步”：后端拉取高德或 mock 数据并标准化，但不写入 `academic_regions`。
3. 预览返回总数、新增数量、更新数量、异常数量和前 20 条样例。
4. 管理员确认后点击“确认入库”。
5. 后端以 `code` 为唯一键执行 upsert：存在则更新名称、层级、上级 code、来源和同步时间；不存在则新增。
6. 同步过程写入 `academic_sync_jobs` 和 `academic_sync_logs`，日志可在页面查看。

如果高德 API 返回异常，系统不会写入正式地区表。

## 5. 直辖市处理规则

直辖市保留高德返回的省级节点和市级节点：

- 重庆市省级节点：`500000`，`level=PROVINCE`，`parentCode=null`。
- 重庆城区市级节点：`500100`，`level=CITY`，`parentCode=500000`。
- 区县节点：例如渝中区 `500103`，`parentCode=500100`。

高校数据匹配时，`provinceCode` 使用省级 `adcode`，`cityCode` 优先使用高德返回的市级节点；如后续数据源只有直辖市省级 code，再由导入流程做兼容映射。

## 6. 本地开发如何使用 mock 数据

推荐本地验证步骤：

```bash
pnpm install
pnpm prisma migrate dev
ACADEMIC_REGION_SYNC_MOCK=true pnpm --filter api start:dev
pnpm --filter web dev
```

访问 `/admin/academic/sync`，点击“预览同步”和“确认入库”。确认后可通过数据库检查 `academic_regions` 是否包含省、市、区县数据，并在页面同步日志中查看结果。
