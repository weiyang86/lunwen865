# 学术基础数据导入设计

## 1. 高校数据来源建议

AcademicData-02 支持通过人工下载的官方 Excel / CSV 文件导入全国高校主数据。本阶段不实现爬虫，不自动抓取网页。推荐数据来源优先级：

1. 教育部公开发布的全国普通高等学校名单、成人高等学校名单。
2. 学信网（CHSI）等可核验的官方或准官方公开名单。
3. 运营人工维护文件，仅作为 MANUAL 来源并降低置信度。

生产导入前应由运营或管理员人工确认文件来源、发布日期、覆盖范围和字段含义。

## 2. 为什么用教育部学校标识码作为 code

`AcademicSchool.code` 推荐使用教育部学校标识码。原因：

- 标识码比学校名称更稳定，可避免学校简称、曾用名、同名院校造成的歧义。
- 后续学院、专业、高校模板、论文任务上下文都可以通过 code 做幂等关联。
- 导入确认使用 `code` upsert：相同 code 更新旧记录，不重复新增。

## 3. 模板字段说明

### 3.1 旧模板字段

```text
provinceCode, cityCode, name, code, schoolType, educationLevels, status, sortOrder, remark
```

### 3.2 新模板字段

```text
provinceCode, cityCode, name, code, schoolType, educationLevels, status, sortOrder, source, sourceVersion, sourceUrl, confidence, remark
```

字段含义：

- `provinceCode`：省级地区 adcode，必须存在于 `academic_regions` 且 level=PROVINCE。
- `cityCode`：市级地区 adcode，必须存在于 `academic_regions` 且 level=CITY，并且 parentCode 指向 `provinceCode`。
- `name`：学校名称，必填。
- `code`：学校标识码，必填且唯一，推荐使用教育部学校标识码。
- `schoolType`：`UNDERGRADUATE` / `VOCATIONAL` / `ADULT` / `OTHER`。
- `educationLevels`：逗号分隔，支持 `UNDERGRADUATE` / `VOCATIONAL` / `MASTER` / `DOCTOR` / `ADULT`。
- `status`：导入模板支持 `ACTIVE` / `DISABLED` / `INACTIVE`；数据库沿用现有 `AcademicStatus.ACTIVE/INACTIVE`。
- `sortOrder`：排序值，可为空，默认 0。
- `source`：`MOE` / `CHSI` / `MANUAL`，为空默认 `MANUAL`。
- `sourceVersion`：来源版本，例如教育部名单发布日期或年份。
- `sourceUrl`：官方文件或公告链接。
- `confidence`：0-100，`MOE` 默认 100，`MANUAL` 默认 80。
- `remark`：备注。

## 4. 旧模板兼容说明

旧模板不包含 `source/sourceVersion/sourceUrl/confidence`。导入时系统会自动补齐：

- `source=MANUAL`
- `confidence=80`
- `reviewStatus=APPROVED`

旧模板仍然必须提供 `provinceCode`、`cityCode`、`name`、`code`。

## 5. provinceCode / cityCode 依赖地区库

高校导入依赖 AcademicData-01 的 `academic_regions`：

1. 导入 preview 会用文件中的 `provinceCode`、`cityCode` 查询地区库。
2. `provinceCode` 必须是省级节点。
3. `cityCode` 必须是市级节点。
4. `cityCode.parentCode` 必须等于 `provinceCode`。
5. 地区校验失败时，preview 返回错误明细，不允许 confirm 入库。

确认入库时，系统会把地区 code 同步到高校记录的 `provinceCode/cityCode` 字段，并确保旧版 `AcademicProvince/AcademicCity` 联动字段可继续使用。

## 6. 导入校验规则

- preview 阶段只解析和校验，不写入正式高校表。
- confirm 必须基于 `previewId`，预览结果过期或含错误行时禁止入库。
- `name`、`code`、`provinceCode`、`cityCode` 必填。
- 文件内重复 `code` 计入重复错误。
- `code` 已存在时标记为更新，不存在时标记为新增。
- `schoolType`、`educationLevels`、`status`、`source`、`confidence` 必须符合枚举或范围。
- 中文“办学层次”兼容转换：本科 -> UNDERGRADUATE；专科/高职 -> VOCATIONAL；成人高校 -> ADULT。

## 7. 常见错误处理

- `provinceCode 不存在于地区库`：先执行地区同步，或修正模板中的 adcode。
- `cityCode 的 parentCode 与 provinceCode 不匹配`：检查学校所在城市与省份是否一致，直辖市应使用地区同步返回的市级节点。
- `code 重复`：同一文件中保留一条；如果是数据库已存在 code，系统会在 confirm 时更新。
- `schoolType/educationLevels/status 枚举错误`：使用模板中的英文枚举；如来源只有中文办学层次，可填写“办学层次”列由系统转换。
- `预览结果已过期`：重新上传文件并再次 preview。

## 8. 本科专业目录字段说明

AcademicData-03 新增本科/高职等专业目录导入模板：

```text
code, name, categoryCode, categoryName, disciplineCode, disciplineName, educationLevel, degree, years, status, version, source, sourceVersion, sourceUrl, confidence, remark
```

- `code`：专业代码，必填且唯一；相同 code 确认导入时更新。
- `name`：专业名称，必填。
- `categoryCode/categoryName`：专业类代码与名称，例如 `0809 / 计算机类`。
- `disciplineCode/disciplineName`：门类代码与名称，例如 `08 / 工学`。
- `educationLevel`：`UNDERGRADUATE` / `VOCATIONAL` / `MASTER` / `DOCTOR`。
- `degree`：授予学位。
- `years`：修业年限。
- `status`：`ACTIVE` / `DISABLED` / `INACTIVE`。
- `version/source/sourceVersion/sourceUrl/confidence`：官方目录版本、来源和置信度。

## 9. 研究生学科目录字段说明

AcademicData-03 新增研究生教育学科目录导入模板：

```text
code, name, parentCode, level, type, educationLevels, status, version, source, sourceVersion, sourceUrl, confidence, remark
```

- `code`：学科代码，必填且唯一；相同 code 确认导入时更新。
- `name`：学科名称，必填。
- `parentCode`：上级代码；存在时必须能在本次文件或已有学科目录中找到。
- `level`：`DISCIPLINE_CATEGORY` / `FIRST_LEVEL_DISCIPLINE` / `SECOND_LEVEL_DISCIPLINE` / `PROFESSIONAL_DEGREE`。
- `type`：`ACADEMIC` / `PROFESSIONAL`。
- `educationLevels`：`MASTER` / `DOCTOR` / `MASTER,DOCTOR`。
- `source`：`MOE` / `DEGREE_COMMITTEE` / `MANUAL`。

## 10. 官方目录版本管理

专业目录和学科目录均保存 `version`、`sourceVersion`、`sourceUrl`、`syncKey`、`confidence`、`lastSyncedAt` 与 `reviewStatus`。建议使用官方发布年份作为 `version/sourceVersion`，使用官方公告或文件地址作为 `sourceUrl`，便于后续追溯。

## 11. 专业目录与学校实际开设专业的区别

专业目录是国家标准目录，回答“有哪些专业代码/专业名称”；学校实际开设专业关系回答“某高校是否开设某专业”。AcademicData-03 只导入标准目录，不建立高校与专业的开设关系。

## 12. 学科目录与研究生招生专业的区别

研究生学科目录是学科/专业学位类别标准，不能直接等同于某学校当年招生专业。招生专业还包含研究方向、学院、导师、年份、考试科目等信息，后续应单独建模。

## 13. 专业/学科目录导入常见错误

- `parentCode 必须存在`：先在同一文件中加入上级学科，或确认数据库已有该上级代码。
- `educationLevel/educationLevels 枚举错误`：本科专业使用 `UNDERGRADUATE`，研究生学科使用 `MASTER,DOCTOR` 等研究生层次。
- `code 重复`：文件内重复会阻止确认导入；数据库已存在则作为更新。
- `version 为空`：可导入但不推荐，建议填写官方目录年份。
