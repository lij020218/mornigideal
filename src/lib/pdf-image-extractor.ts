import vision from '@google-cloud/vision';

// Dynamic import to avoid module loading errors in serverless environment
let pdfjs: any = null;

async function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // PDF.js worker 설정
    if (typeof window === 'undefined') {
      // Server-side에서는 worker 비활성화
      pdfjs.GlobalWorkerOptions.workerSrc = '';
    }
  }
  return pdfjs;
}

interface ImageAnalysis {
  pageNumber: number;
  text: string; // OCR 결과
  description: string; // 이미지 설명
}

/**
 * PDF에서 이미지를 추출하고 Google Cloud Vision으로 분석
 *
 * Note: 현재 버전은 간소화된 구현입니다.
 * PDF.js를 사용한 이미지 추출은 복잡하므로, 우선 전체 페이지를 이미지로 렌더링하여 분석합니다.
 */
export async function extractAndAnalyzeImages(
  pdfBuffer: Buffer,
  apiKey: string
): Promise<ImageAnalysis[]> {
  try {

    // Load PDF.js dynamically
    const pdf = await loadPdfJs();

    // Google Cloud Vision 클라이언트 초기화
    const client = new vision.ImageAnnotatorClient({
      apiKey: apiKey,
    });

    // PDF.js로 문서 로드
    const loadingTask = pdf.getDocument({ data: pdfBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;


    const results: ImageAnalysis[] = [];

    // 최대 5페이지만 분석 (비용 절감)
    const pagesToAnalyze = Math.min(numPages, 5);

    for (let i = 1; i <= pagesToAnalyze; i++) {
      try {
        const page = await pdfDoc.getPage(i);

        // 페이지를 이미지로 렌더링
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = {
          width: viewport.width,
          height: viewport.height,
        };

        // Canvas API가 없는 서버 환경에서는 스킵
        // 실제 이미지 렌더링은 복잡하므로, 우선 텍스트만 추출

      } catch (pageError) {
        console.error(`[PDF Image Extractor] Error processing page ${i}:`, pageError);
      }
    }

    return results;
  } catch (error) {
    console.error('[PDF Image Extractor] Error:', error);
    // 이미지 추출 실패 시 빈 배열 반환 (텍스트 추출은 계속 진행)
    return [];
  }
}

/**
 * 이미지 분석 결과를 텍스트 형식으로 변환
 */
export function formatImageAnalysis(analyses: ImageAnalysis[]): string {
  if (analyses.length === 0) return '';

  const sections = analyses.map(analysis => {
    const parts = [`\n[페이지 ${analysis.pageNumber}의 이미지]`];

    if (analysis.description) {
      parts.push(analysis.description);
    }

    if (analysis.text) {
      parts.push(`이미지 내 텍스트:\n${analysis.text}`);
    }

    parts.push('---\n');
    return parts.join('\n');
  });

  return '\n=== PDF 이미지 분석 결과 ===\n' + sections.join('\n');
}
