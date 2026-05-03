export interface DocxStyleConfig {
  defaultFont: string;
  cnFont: string;
  titleSize: number;
  h1Size: number;
  h2Size: number;
  h3Size: number;
  bodySize: number;
  lineHeight: number;
  firstLineIndent: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  includeTOC: boolean;
  includeCover: boolean;
  header?: string;
  showPageNumber: boolean;
}

export const TEMPLATE_CONFIGS: Record<string, DocxStyleConfig> = {
  GENERIC: {
    defaultFont: 'Times New Roman',
    cnFont: '宋体',
    titleSize: 22,
    h1Size: 18,
    h2Size: 16,
    h3Size: 14,
    bodySize: 12,
    lineHeight: 360,
    firstLineIndent: 400,
    marginTop: 1440,
    marginBottom: 1440,
    marginLeft: 1440,
    marginRight: 1440,
    includeTOC: true,
    includeCover: false,
    showPageNumber: true,
  },
  UNDERGRADUATE: {
    defaultFont: 'Times New Roman',
    cnFont: '宋体',
    titleSize: 24,
    h1Size: 18,
    h2Size: 16,
    h3Size: 14,
    bodySize: 12,
    lineHeight: 360,
    firstLineIndent: 400,
    marginTop: 1440,
    marginBottom: 1440,
    marginLeft: 1701,
    marginRight: 1440,
    includeTOC: true,
    includeCover: true,
    showPageNumber: true,
  },
  MASTER: {
    defaultFont: 'Times New Roman',
    cnFont: '宋体',
    titleSize: 26,
    h1Size: 20,
    h2Size: 16,
    h3Size: 14,
    bodySize: 12,
    lineHeight: 480,
    firstLineIndent: 400,
    marginTop: 1701,
    marginBottom: 1440,
    marginLeft: 1701,
    marginRight: 1440,
    includeTOC: true,
    includeCover: true,
    showPageNumber: true,
  },
};
