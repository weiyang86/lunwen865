-- CreateEnum
CREATE TYPE "AcademicStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "AcademicProvince" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicProvince_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCity" (
    "id" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicSchool" (
    "id" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50),
    "schoolType" VARCHAR(50),
    "educationLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCollege" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50),
    "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicCollege_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicMajor" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "collegeId" TEXT,
    "disciplineCategoryId" TEXT,
    "disciplineLevelOneId" TEXT,
    "disciplineLevelTwoId" TEXT,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50),
    "educationLevel" VARCHAR(40),
    "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicMajor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineCategory" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplineCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineLevelOne" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplineLevelOne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineLevelTwo" (
    "id" TEXT NOT NULL,
    "levelOneId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplineLevelTwo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicProvince_code_key" ON "AcademicProvince"("code");
CREATE INDEX "AcademicProvince_status_sortOrder_idx" ON "AcademicProvince"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCity_provinceId_code_key" ON "AcademicCity"("provinceId", "code");
CREATE INDEX "AcademicCity_provinceId_status_sortOrder_idx" ON "AcademicCity"("provinceId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSchool_code_key" ON "AcademicSchool"("code");
CREATE INDEX "AcademicSchool_provinceId_status_sortOrder_idx" ON "AcademicSchool"("provinceId", "status", "sortOrder");
CREATE INDEX "AcademicSchool_cityId_status_sortOrder_idx" ON "AcademicSchool"("cityId", "status", "sortOrder");
CREATE INDEX "AcademicSchool_name_idx" ON "AcademicSchool"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCollege_schoolId_name_key" ON "AcademicCollege"("schoolId", "name");
CREATE UNIQUE INDEX "AcademicCollege_schoolId_code_key" ON "AcademicCollege"("schoolId", "code");
CREATE INDEX "AcademicCollege_schoolId_status_sortOrder_idx" ON "AcademicCollege"("schoolId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicMajor_schoolId_collegeId_name_educationLevel_key" ON "AcademicMajor"("schoolId", "collegeId", "name", "educationLevel");
CREATE INDEX "AcademicMajor_schoolId_status_sortOrder_idx" ON "AcademicMajor"("schoolId", "status", "sortOrder");
CREATE INDEX "AcademicMajor_collegeId_status_sortOrder_idx" ON "AcademicMajor"("collegeId", "status", "sortOrder");
CREATE INDEX "AcademicMajor_disciplineCategoryId_idx" ON "AcademicMajor"("disciplineCategoryId");
CREATE INDEX "AcademicMajor_disciplineLevelOneId_idx" ON "AcademicMajor"("disciplineLevelOneId");
CREATE INDEX "AcademicMajor_disciplineLevelTwoId_idx" ON "AcademicMajor"("disciplineLevelTwoId");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineCategory_code_key" ON "DisciplineCategory"("code");
CREATE INDEX "DisciplineCategory_status_sortOrder_idx" ON "DisciplineCategory"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineLevelOne_categoryId_code_key" ON "DisciplineLevelOne"("categoryId", "code");
CREATE INDEX "DisciplineLevelOne_categoryId_status_sortOrder_idx" ON "DisciplineLevelOne"("categoryId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineLevelTwo_levelOneId_code_key" ON "DisciplineLevelTwo"("levelOneId", "code");
CREATE INDEX "DisciplineLevelTwo_levelOneId_status_sortOrder_idx" ON "DisciplineLevelTwo"("levelOneId", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "AcademicCity" ADD CONSTRAINT "AcademicCity_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "AcademicProvince"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicSchool" ADD CONSTRAINT "AcademicSchool_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "AcademicProvince"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicSchool" ADD CONSTRAINT "AcademicSchool_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "AcademicCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicCollege" ADD CONSTRAINT "AcademicCollege_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "AcademicSchool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicMajor" ADD CONSTRAINT "AcademicMajor_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "AcademicSchool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicMajor" ADD CONSTRAINT "AcademicMajor_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "AcademicCollege"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcademicMajor" ADD CONSTRAINT "AcademicMajor_disciplineCategoryId_fkey" FOREIGN KEY ("disciplineCategoryId") REFERENCES "DisciplineCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcademicMajor" ADD CONSTRAINT "AcademicMajor_disciplineLevelOneId_fkey" FOREIGN KEY ("disciplineLevelOneId") REFERENCES "DisciplineLevelOne"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcademicMajor" ADD CONSTRAINT "AcademicMajor_disciplineLevelTwoId_fkey" FOREIGN KEY ("disciplineLevelTwoId") REFERENCES "DisciplineLevelTwo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplineLevelOne" ADD CONSTRAINT "DisciplineLevelOne_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DisciplineCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplineLevelTwo" ADD CONSTRAINT "DisciplineLevelTwo_levelOneId_fkey" FOREIGN KEY ("levelOneId") REFERENCES "DisciplineLevelOne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
