import { PlaceholderManager } from './placeholder';

describe('PlaceholderManager', () => {
  it('公式占位编解码可逆', () => {
    const pm = new PlaceholderManager();
    const input = '这里有公式 $E=mc^2$ 以及 $$a^2+b^2=c^2$$。';
    const encoded = pm.encode(input);
    const decoded = pm.decode(encoded);
    expect(decoded).toBe(input);
  });

  it('引用编号占位可逆', () => {
    const pm = new PlaceholderManager();
    const input = '参考文献见[1][12]。';
    const encoded = pm.encode(input);
    const decoded = pm.decode(encoded);
    expect(decoded).toBe(input);
  });

  it('嵌套场景', () => {
    const pm = new PlaceholderManager();
    const input = '```ts\nconst x = 1; // [1]\n```\n并且有 $a+b$ 与[2]。';
    const encoded = pm.encode(input);
    const decoded = pm.decode(encoded);
    expect(decoded).toBe(input);
  });

  it('preserveTerms 正确占位可逆', () => {
    const pm = new PlaceholderManager();
    const input = '本文讨论卷积神经网络与 Transformer 的表示能力。';
    const encoded = pm.encode(input, ['卷积神经网络', 'Transformer']);
    const decoded = pm.decode(encoded);
    expect(decoded).toBe(input);
  });
});
