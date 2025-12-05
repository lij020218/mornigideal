/***************************************************************************
 * SMART CHUNKING PARSER (OPTIMIZED)
 * - 목표: 폰트 크기/위치 정보를 활용하여 정확한 섹션 분리 및 O(N) 성능 달성
 * - 특징: Mode 기반 본문 크기 감지, Y좌표 정렬, 단일 패스 병합
 ***************************************************************************/

export interface ParsedItem {
  str: string;
  height: number;
  y: number;
  hasEOL: boolean;
}

export interface SmartChunk {
  id: number;
  title: string;
  content: string[]; // 문장 단위로 저장
  subHeadings: string[]; // 섹션 내부의 소제목들
  metadata: {
    formulas: string[];
    examples: string[];
    pageNumbers: number[];
  };
}

export interface CompactPDF {
  docTitle: string;
  chunks: SmartChunk[];
  stats: {
    originalSectionCount: number;
    finalChunkCount: number;
  };
}

// --------------------------------------------------------------------------
// 1. 설정값 (Sensitivity)
// --------------------------------------------------------------------------
const CONFIG = {
  MIN_CHUNK_LENGTH: 200,
  TARGET_CHUNK_COUNT: 25,
  HEADING_SCALE_THRESHOLD: 1.2, // 본문보다 20% 이상 크면 헤딩으로 간주
};

// --------------------------------------------------------------------------
// 2. 파싱 로직
// --------------------------------------------------------------------------
export function parseWithSmartChunking(input: ParsedItem[] | string): CompactPDF {
  // 하위 호환성: 문자열이 들어오면 기존 방식(줄 단위 분리)으로 처리하되, 높이 정보는 0으로
  let items: ParsedItem[] = [];

  if (typeof input === 'string') {
    items = input.split('\n').map(line => ({
      str: line.trim(),
      height: 0,
      y: 0,
      hasEOL: true
    })).filter(i => i.str.length > 0);
  } else {
    items = preprocessItems(input);
  }

  // 1. 본문 폰트 크기 계산 (Mode)
  const bodySize = calculateBodySize(items);
  console.log(`[PARSER] Detected Body Size: ${bodySize}`);

  // 2. 청크 생성 (Single Pass)
  let rawChunks: SmartChunk[] = [];
  let chunkIdCounter = 1;
  let detectedTitle = "";

  // 초기 청크
  let currentChunk = createNewChunk(chunkIdCounter++, "Introduction");

  for (const item of items) {
    // 페이지 번호 노이즈 제거
    if (/^Page\s?\d+$/i.test(item.str) || /^\d+$/.test(item.str)) continue;

    // 헤딩 감지
    if (isHeading(item, bodySize)) {
      // 문서 제목 추정 (가장 먼저 나오는 큰 헤딩)
      if (!detectedTitle && item.str.length > 5) detectedTitle = item.str;

      // 새 섹션 분리 조건:
      // 1. 현재 청크에 내용이 좀 있고 (50자 이상)
      // 2. 헤딩이 확실할 때
      if (currentChunk.content.join(" ").length > 50) {
        rawChunks.push(currentChunk);
        currentChunk = createNewChunk(chunkIdCounter++, item.str);
      } else {
        // 내용이 너무 적으면 그냥 소제목으로 편입
        currentChunk.subHeadings.push(item.str);
        currentChunk.content.push(`\n[Topic: ${item.str}]`);
      }
      continue;
    }

    // 내용 채우기
    if (isFormula(item.str)) {
      currentChunk.metadata.formulas.push(item.str);
      currentChunk.content.push(`(Formula)`);
    } else if (isExampleStart(item.str)) {
      currentChunk.metadata.examples.push(item.str);
      currentChunk.content.push(item.str);
    } else {
      currentChunk.content.push(item.str);
    }
  }

  // 마지막 청크 추가
  rawChunks.push(currentChunk);

  // 3. 압축 (O(N) Single Pass Merge)
  const optimizedChunks = mergeChunksOptimally(rawChunks);

  return {
    docTitle: detectedTitle || "Untitled Document",
    chunks: optimizedChunks,
    stats: {
      originalSectionCount: rawChunks.length,
      finalChunkCount: optimizedChunks.length
    }
  };
}

// --------------------------------------------------------------------------
// 3. 전처리 및 헬퍼 함수들
// --------------------------------------------------------------------------

// Y좌표 정렬 및 같은 라인 텍스트 병합
function preprocessItems(rawItems: ParsedItem[]): ParsedItem[] {
  // 1. Y좌표(내림차순 - PDF는 아래에서 위로 가는 경우 많음, 하지만 보통 라이브러리는 Top-Left 기준일 수 있음)
  // pdf-parse-fork의 transform[5]는 보통 Bottom-Left 기준 Y좌표.
  // 페이지가 바뀌면 Y좌표가 튀므로, 여기서는 "페이지별로 이미 정렬되어 들어온다"고 가정하고
  // 같은 페이지 내에서의 라인 병합에 집중하거나, 
  // 단순히 순서대로 처리하되 "같은 라인" 판단만 함.
  // *사용자 피드백*: "같은 라인(Y좌표가 비슷한)에 있는 텍스트를 먼저 합쳐야 합니다."

  const mergedItems: ParsedItem[] = [];
  let currentLine: ParsedItem | null = null;

  for (const item of rawItems) {
    if (!item.str.trim()) continue; // 공백 제거

    if (!currentLine) {
      currentLine = { ...item };
      continue;
    }

    // 같은 라인인지 판별 (Y좌표 차이가 미세하면 같은 라인)
    // transform[5]가 Y좌표.
    const yDiff = Math.abs(item.y - currentLine.y);

    // 같은 라인으로 간주 (오차범위 5)
    if (yDiff < 5) {
      currentLine.str += " " + item.str;
      // 높이는 더 큰 것을 따라감 (헤딩이 섞여있을 경우)
      currentLine.height = Math.max(currentLine.height, item.height);
    } else {
      // 라인 바뀜 -> 저장 후 새로 시작
      mergedItems.push(currentLine);
      currentLine = { ...item };
    }
  }

  if (currentLine) mergedItems.push(currentLine);

  return mergedItems;
}

// 본문 폰트 크기(Body Text Height) 계산 - Mode(최빈값) 사용
function calculateBodySize(items: ParsedItem[]): number {
  const frequency: Record<number, number> = {};

  for (const item of items) {
    // 소수점 노이즈 제거 (반올림)
    const h = Math.round(item.height * 10) / 10;
    if (h > 0) {
      frequency[h] = (frequency[h] || 0) + item.str.length; // 빈도 가중치를 길이로 줌 (긴 문장이 본문일 확률 높음)
    }
  }

  // 가장 많이 등장한(길이가 긴) 높이가 본문 크기
  const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return 10; // 기본값
  return Number(sorted[0][0]);
}

function isHeading(item: ParsedItem, bodySize: number): boolean {
  const isBig = item.height > bodySize * CONFIG.HEADING_SCALE_THRESHOLD;
  const isShort = item.str.length < 80;
  const hasEndPunctuation = /[.?!]$/.test(item.str.trim());

  // 1. 폰트 크기가 크고, 문장이 아니며(마침표 없음), 적당히 짧으면 헤딩
  if (isBig && !hasEndPunctuation && isShort) return true;

  // 2. 크기는 본문과 같아도 패턴이 확실하면 헤딩 (기존 RegEx 활용)
  if (isStrictPattern(item.str)) return true;

  return false;
}

function isStrictPattern(line: string): boolean {
  // 1) "Chapter 1", "Part A", "Section 3" 패턴
  if (/^(Chapter|Part|Section|제|강)\s?\d+/i.test(line)) return true;
  // 2) "1.", "II." 같은 넘버링 + 적절한 길이
  if (/^(\d+\.|[IVX]+\.)\s+[A-Z가-힣]/.test(line)) return true;
  // 3) ALL CAPS (영어) - 짧은 경우만
  if (/^[A-Z\s\d:]{5,50}$/.test(line) && !/[a-z]/.test(line)) return true;
  return false;
}

function isFormula(line: string): boolean {
  return line.includes('=') && (line.includes('\\') || /[∑∫√]/.test(line));
}

function isExampleStart(line: string): boolean {
  return /^(Example|예시|Case|Scenario)/i.test(line);
}

function createNewChunk(id: number, title: string): SmartChunk {
  return {
    id,
    title,
    content: [],
    subHeadings: [],
    metadata: { formulas: [], examples: [], pageNumbers: [] }
  };
}

// O(N) Single Pass Merging
function mergeChunksOptimally(chunks: SmartChunk[]): SmartChunk[] {
  if (chunks.length <= CONFIG.TARGET_CHUNK_COUNT) return chunks;

  const merged: SmartChunk[] = [];
  let buffer: SmartChunk | null = null;

  for (const chunk of chunks) {
    if (!buffer) {
      buffer = chunk;
      continue;
    }

    // 병합 조건 확인
    const bufferLen = buffer.content.join(" ").length;
    const currentLen = chunk.content.join(" ").length;

    const shouldMerge =
      (bufferLen < CONFIG.MIN_CHUNK_LENGTH) ||
      (currentLen < 100) ||
      (chunk.title.includes(buffer.title) || buffer.title.includes(chunk.title));

    if (shouldMerge) {
      // 병합 수행 (배열 push는 빠름)
      buffer.content.push(...chunk.content);
      buffer.metadata.formulas.push(...chunk.metadata.formulas);
      buffer.metadata.examples.push(...chunk.metadata.examples);
      buffer.subHeadings.push(chunk.title);
    } else {
      // 버퍼 방출 후 새로 시작
      merged.push(buffer);
      buffer = chunk;
    }
  }

  if (buffer) merged.push(buffer);

  // 여전히 너무 많으면 강제 병합 (짝수/홀수) - 재귀적으로 한 번 더 수행
  if (merged.length > CONFIG.TARGET_CHUNK_COUNT * 1.5) {
    // 간단한 짝수/홀수 병합
    const forcedMerged: SmartChunk[] = [];
    for (let i = 0; i < merged.length; i += 2) {
      const c1 = merged[i];
      const c2 = merged[i + 1];
      if (c2) {
        c1.content.push(...c2.content);
        c1.metadata.formulas.push(...c2.metadata.formulas);
        c1.metadata.examples.push(...c2.metadata.examples);
        c1.subHeadings.push(c2.title);
        forcedMerged.push(c1);
      } else {
        forcedMerged.push(c1);
      }
    }
    return forcedMerged;
  }

  return merged;
}

// --------------------------------------------------------------------------
// 4. 요약 생성기
// --------------------------------------------------------------------------
export function createEfficientSummary(pdf: CompactPDF): string {
  const output: string[] = [`# ${pdf.docTitle}`, ""];

  for (const chunk of pdf.chunks) {
    output.push(`## ${chunk.title}`);
    const textBody = chunk.content.join(" ");
    output.push(textBody.slice(0, 400) + (textBody.length > 400 ? "..." : ""));
    if (chunk.subHeadings.length > 0) {
      output.push(`\n*Sub-topics: ${chunk.subHeadings.join(', ')}*`);
    }
    if (chunk.metadata.formulas.length > 0) {
      output.push(`\n> **Key Formulas:**\n> ${chunk.metadata.formulas.slice(0, 3).join('\n> ')}`);
    }
    output.push("");
  }
  return output.join("\n");
}
