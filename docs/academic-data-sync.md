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

## AcademicData-05：学校-学院-专业关系补充与审核

学校实际开设专业是论文任务生成的重要上下文：本科/研究生官方专业目录只说明“国家允许设置的专业”，不能证明某一高校在某一学院实际开设。因此新增 `academic_school_majors` 作为正式关系表，并新增 `academic_school_major_staging` 作为采集候选审核表，避免采集结果直接覆盖生产数据。

### 西南片区补充策略

沿用西南片区快捷范围：重庆市 `500000`、四川省 `510000`、贵州省 `520000`、云南省 `530000`、西藏自治区 `540000`。后台列表和 staging 查询支持通过 `provinceCode` / `cityCode` 过滤学校，默认人工运营优先补齐西南高校的学校-学院-专业关系。

### 定向采集边界

学校专业采集只请求后台人工输入的公开招生网、学院官网或招生简章 URL，不做全网搜索、不绕过登录/验证码、不抓取非公开数据、不高频请求。`SchoolMajorDataService.runCrawl` 会先匹配高校，再从公开 HTML 中提取专业名称候选，匹配 `academic_catalog_majors` 和 `academic_colleges` 后写入 `academic_school_major_staging`，不会直接写入正式表。

### staging + 人工审核流程

1. 运营输入 `schoolCode`、公开 URL、`educationLevel` 运行采集。
2. 候选数据进入 `academic_school_major_staging`，保留 `sourceUrl`、`rawData`、`confidence`。
3. 管理员在待审核列表中逐条通过或驳回，也可以批量通过。
4. 审核通过时按 `schoolCode + majorCode + educationLevel` upsert 至 `academic_school_majors`；驳回只更新 staging 状态，不影响正式关系。

### 置信度规则

- 页面同时出现专业名称和专业代码，且命中专业目录：`90+`。
- 专业名称命中专业目录：`80`。
- 仅从页面文字识别出疑似专业名称：`60`。
- 人工导入默认 `MANUAL` 来源，未填写 confidence 时按 `90` 处理。

### 论文任务上下文预留

后端新增 `AcademicContextService.getSchoolMajorContext(params)`，可根据 `schoolCode`、`collegeName`、`majorName`、`educationLevel` 查询正式关系，返回 school、college、major、matchedRelations、source、confidence，供后续论文任务生成链路使用。

## AcademicData-06：研究生招生专业补充与论文上下文

研究生招生专业是招生维度数据，不等同于 `academic_disciplines` 研究生学科目录。学科目录描述国家标准学科/专业学位类别，研究生招生专业还包含学校、学院、专业代码、专业名称、硕博层次、研究方向、学习方式、来源年份等信息，因此新增 `academic_postgraduate_programs` 和 `academic_postgraduate_program_staging`，且不会覆盖 `academic_disciplines`。

### 西南片区补充策略

继续优先补齐重庆 `500000`、四川 `510000`、贵州 `520000`、云南 `530000`、西藏 `540000` 高校。列表和 staging 查询支持通过 `provinceCode` / `cityCode` 反查高校并过滤研究生招生专业，便于运营从西南高校开始补齐硕士、博士论文生成上下文。

### 数据来源与采集边界

允许来源包括研招网硕士专业目录导出文件、学校研究生院官网公开招生目录、招生简章公开页面。系统只请求后台人工输入的 URL，不全网搜索，不绕过登录/验证码，不抓取非公开数据，不高频请求。如果研招网页面有验证码、登录或反爬限制，应改为运营上传导出的 Excel / CSV 或学校公开文件。

### staging 审核流程

1. 运营上传模板或输入公开 URL、`schoolCode`、`degreeLevel`、`sourceType`。
2. 导入 preview 不写正式库；采集结果只写 `academic_postgraduate_program_staging`。
3. 管理员审核候选，确认来源 URL、rawData、置信度、研究方向和学习方式。
4. 审核通过后按 `syncKey = schoolCode + collegeName + programCode + degreeLevel + researchDirection` upsert 到 `academic_postgraduate_programs`；驳回不写正式库。

### 论文上下文增强

`AcademicContextService` 新增 `getPostgraduateContext(params)`，根据学校、学院、学科代码、招生专业名称和硕博层次返回研究生招生专业、研究方向、来源和置信度；统一方法 `getThesisAcademicContext(params)` 会在本科/高职场景优先查询学校开设专业关系，在硕士/博士场景优先查询研究生招生专业。
