import type { Reference, RefType } from '@prisma/client';

function formatAuthors(authors: string): string {
  return authors
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .join(', ');
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function getTypeMarker(type: RefType): string {
  if (type === 'JOURNAL') return '[J]';
  if (type === 'BOOK') return '[M]';
  if (type === 'THESIS') return '[D]';
  if (type === 'CONFERENCE') return '[C]';
  if (type === 'STANDARD') return '[S]';
  if (type === 'PATENT') return '[P]';
  if (type === 'WEB') return '[EB/OL]';
  if (type === 'NEWSPAPER') return '[N]';
  return '[R]';
}

export function formatGBT7714(ref: Reference): string {
  const idx = ref.index;
  const authors = formatAuthors(ref.authors);
  const title = ref.title.trim();
  const year = ref.year ?? '';
  const marker = getTypeMarker(ref.type);

  if (ref.type === 'JOURNAL') {
    const journal = ref.journal?.trim() ?? '';
    const volume = ref.volume?.trim();
    const issue = ref.issue?.trim();
    const pages = ref.pages?.trim();
    const vi =
      volume && issue
        ? `${volume}(${issue})`
        : volume
          ? volume
          : issue
            ? `(${issue})`
            : '';
    const tail = [year, vi].filter(Boolean).join(', ');
    const pagePart = pages ? `: ${pages}` : '';
    return `[${idx}] ${authors}. ${title}${marker}. ${journal}${tail ? `, ${tail}` : ''}${pagePart}.`;
  }

  if (ref.type === 'BOOK') {
    const city = ref.city?.trim();
    const publisher = ref.publisher?.trim();
    const pages = ref.pages?.trim();
    const pub = [city, publisher].filter(Boolean).join(': ');
    const pagePart = pages ? `: ${pages}` : '';
    const yearPart = year ? `, ${year}` : '';
    return `[${idx}] ${authors}. ${title}${marker}. ${pub}${yearPart}${pagePart}.`;
  }

  if (ref.type === 'THESIS') {
    const university = ref.university?.trim() ?? '';
    const yearPart = year ? `, ${year}` : '';
    return `[${idx}] ${authors}. ${title}${marker}. ${university}${yearPart}.`;
  }

  if (ref.type === 'CONFERENCE') {
    const pages = ref.pages?.trim();
    const yearPart = year ? `, ${year}` : '';
    const pagePart = pages ? `: ${pages}` : '';
    return `[${idx}] ${authors}. ${title}${marker}.${yearPart}${pagePart}.`;
  }

  if (ref.type === 'STANDARD') {
    const yearPart = year ? `, ${year}` : '';
    return `[${idx}] ${authors}. ${title}${marker}.${yearPart}.`;
  }

  if (ref.type === 'NEWSPAPER') {
    const yearPart = year ? `, ${year}` : '';
    const pages = ref.pages?.trim();
    const pagePart = pages ? `: ${pages}` : '';
    return `[${idx}] ${authors}. ${title}${marker}.${yearPart}${pagePart}.`;
  }

  if (ref.type === 'WEB') {
    const url = ref.url?.trim() ?? '';
    const published = ref.year ? `${ref.year}-01-01` : '';
    const access = ref.accessDate ? formatDate(ref.accessDate) : '';
    const datePart = published && access ? `(${published})[${access}].` : '';
    return `[${idx}] ${authors}. ${title}${marker}. ${datePart} ${url}.`;
  }

  const yearPart = year ? `, ${year}` : '';
  return `[${idx}] ${authors}. ${title}${marker}.${yearPart}.`;
}
