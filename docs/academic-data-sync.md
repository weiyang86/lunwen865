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

## 7. AcademicData-04 学院数据采集与审核

学院数据没有稳定的全国统一官方 API，同一高校的学院设置还会随学校官网调整、机构合并或院系更名变化。因此本阶段不做“全网自动同步”，而采用“人工导入 + 定向采集 + staging 审核”的流程。

### 7.1 西南片区优先策略

首期快捷范围为 SOUTHWEST：

- `500000` 重庆市
- `510000` 四川省
- `520000` 贵州省
- `530000` 云南省
- `540000` 西藏自治区

学院采集源默认 scope 为 `SOUTHWEST`，后台页面和接口可按 `provinceCode/cityCode/schoolCode` 筛选。

### 7.2 学院采集边界

- 只采集公开网页。
- 不绕过登录、验证码或访问控制。
- 不抓取非公开数据。
- 不高频请求；采集必须由后台配置 URL 或人工传入 URL 后触发。
- 采集结果只进入 `academic_college_staging`，不得直接覆盖正式 `AcademicCollege`。

### 7.3 staging + 人工审核流程

1. 管理员为高校配置学院页面 URL，或直接传入学校 code + URL 运行采集。
2. `CollegeCrawlerService` 解析页面链接文本，提取包含“学院/学部/系/研究院/中心”的候选项，并过滤通知公告、新闻动态等非学院导航。
3. 候选写入 `academic_college_staging`，状态为 `PENDING`。
4. 管理员在待审核列表中逐条通过、驳回或批量通过。
5. 审核通过后才 upsert 到正式 `AcademicCollege`，唯一依据为 `schoolId + name`。

### 7.4 学院数据置信度规则

- 人工模板导入默认 `MANUAL`，建议置信度 90。
- 官网采集默认 `SCHOOL_SITE`，包含“学院/学部”的候选置信度较高，研究院/中心等候选置信度较低。
- 置信度仅辅助审核，不替代人工确认。

### 7.5 如何配置高校官网学院页面 URL

通过后台接口配置：

```http
POST /api/admin/academic-data/colleges/crawl-sources
Content-Type: application/json

{
  "schoolCode": "4150010637",
  "url": "https://www.example.edu.cn/yxsz.htm",
  "sourceType": "COLLEGE_PAGE",
  "scope": "SOUTHWEST",
  "enabled": true
}
```

运行单次采集：

```http
POST /api/admin/academic-data/colleges/crawl/run
Content-Type: application/json

{
  "schoolCode": "4150010637",
  "url": "https://www.example.edu.cn/yxsz.htm"
}
```
