import { PDFDocument } from 'pdf-lib';
import vision from '@google-cloud/vision';

interface ImageAnalysis {
  pageNumber: number;
  text: string; // OCR 결과
  description: string; // 이미지 설명
}

/**
 * PDF에서 이미지를 추출하고 Google Cloud Vision으로 분석
 */
export async function extractAndAnalyzeImages(
  pdfBuffer: Buffer,
  apiKey: string
): Promise<ImageAnalysis[]> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    const results: ImageAnalysis[] = [];

    console.log(`[PDF Image Extractor] Processing ${pageCount} pages`);

    // Google Cloud Vision 클라이언트 초기화
    const client = new vision.ImageAnnotatorClient({
      apiKey: apiKey,
    });

    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);

      // PDF 페이지에서 이미지 객체 찾기
      const { Resources } = page.node;
      if (!Resources) continue;

      const xObjects = Resources.get('XObject');
      if (!xObjects) continue;

      const xObjectKeys = xObjects.keys();

      for (const key of xObjectKeys) {
        try {
          const xObject = xObjects.get(key);
          if (!xObject || xObject.get('Subtype')?.toString() !== '/Image') {
            continue;
          }

          // 이미지 데이터 추출
          const imageData = xObject.get('stream');
          if (!imageData) continue;

          // Google Cloud Vision으로 분석
          const [result] = await client.annotateImage({
            image: { content: imageData },
            features: [
              { type: 'TEXT_DETECTION' }, // OCR
              { type: 'LABEL_DETECTION' }, // 이미지 라벨링
              { type: 'DOCUMENT_TEXT_DETECTION' }, // 문서 OCR (더 정확)
            ],
          });

          // OCR 텍스트 추출
          const ocrText = result.fullTextAnnotation?.text || '';

          // 이미지 설명 생성 (라벨 기반)
          const labels = result.labelAnnotations?.map(label => label.description).slice(0, 5) || [];
          const description = labels.length > 0
            ? `이미지 내용: ${labels.join(', ')}`
            : '이미지 분석 결과 없음';

          if (ocrText || labels.length > 0) {
            results.push({
              pageNumber: i + 1,
              text: ocrText,
              description: description,
            });

            console.log(`[PDF Image Extractor] Page ${i + 1}: Found image with ${ocrText.length} chars OCR text`);
          }
        } catch (imgError) {
          console.error(`[PDF Image Extractor] Error processing image on page ${i + 1}:`, imgError);
          // 개별 이미지 오류는 무시하고 계속 진행
        }
      }
    }

    console.log(`[PDF Image Extractor] Extracted ${results.length} images`);
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
