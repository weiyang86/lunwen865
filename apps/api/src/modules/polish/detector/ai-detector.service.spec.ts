import { AiDetectorService } from './ai-detector.service';

describe('AiDetectorService', () => {
  const detector = new AiDetectorService();

  it('空文本返回 0', async () => {
    await expect(detector.detect('')).resolves.toBe(0);
  });

  it('全机械连接词文本得分较高', async () => {
    const input =
      '首先，我们提出方法。其次，我们进行实验。最后，我们给出结论。综上所述，因此进一步总之。'.repeat(
        10,
      );
    const score = await detector.detect(input);
    expect(score).toBeGreaterThan(70);
  });

  it('自然口语化文本得分较低', async () => {
    const input =
      '我觉得这个问题其实不复杂，先把输入数据理清楚，再按步骤做就行。中间如果哪里卡住了，就回到前面的假设检查一下，别急着下结论。';
    const score = await detector.detect(input);
    expect(score).toBeLessThan(40);
  });
});
