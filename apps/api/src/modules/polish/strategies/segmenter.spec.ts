import { segmentText } from './segmenter';

describe('segmentText', () => {
  it('短文本不切分', () => {
    const input = '这是短文本。';
    const segments = segmentText(input, 800);
    expect(segments).toEqual([input]);
  });

  it('多段落正确切分', () => {
    const input = '第一段。\n\n第二段。\n\n第三段。';
    const segments = segmentText(input, 800);
    expect(segments).toHaveLength(3);
    expect(segments.join('')).toBe(input);
  });

  it('超长段落二次切分', () => {
    const long = '很长的句子。'.repeat(300);
    const segments = segmentText(long, 800);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.join('')).toBe(long);
  });

  it('极端：单句超长强制截断', () => {
    const input = 'a'.repeat(1000);
    const segments = segmentText(input, 800);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.join('')).toBe(input);
  });

  it('保留段落换行结构', () => {
    const input = 'A段。\n\n\nB段。';
    const segments = segmentText(input, 800);
    expect(segments.join('')).toBe(input);
  });
});
