import { NotFoundException } from '@nestjs/common';

export class SectionNotFoundException extends NotFoundException {
  constructor(sectionId: string) {
    super(`写作小节不存在（sectionId=${sectionId}）`);
  }
}
