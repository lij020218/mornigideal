import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import pdfParse from "pdf-parse-fork";
import crypto from "crypto";
import { extractAndAnalyzeImages, formatImageAnalysis } from "@/lib/pdf-image-extractor";

// Route segment config for large file uploads
export const maxDuration = 300; // 5 minutes for Vercel Pro
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Model Configuration
const MINI_MODEL = "gpt-5-mini-2025-08-07";      // Intelligent chunking
const ADVANCED_MODEL = "gpt-5.1-2025-11-13";    // High-quality conversion

/**
 * SMART HYBRID PIPELINE (2025-12-04)
 *
 * 목적: 품질 유지 + 비용 절감
 *
 * Architecture:
 * 1. PDF → Text Extraction (pdf-parse-fork)
 * 2. GPT-5 Mini: 원문을 3-4개 균등 청크로 분할 (컨텍스트 유지)
 * 3. GPT-5.1 순차: 각 청크를 A 모드로 변환 (이전 결과 참조)
 *
 * 비용 최적화:
 * - Mini 1회: ~$0.001 (청크 분할)
 * - Advanced 3-4회: ~$0.03-0.05 (각 청크 2-3K output)
 * - 총: ~$0.04-0.06 (기존 $0.15 대비 60-73% 절감)
 */

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: string, data: any) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  (async () => {
    const startTime = Date.now();

    try {
      const session = await auth();
      if (!session?.user?.email) {
        await sendEvent("error", { error: "Unauthorized" });
        await writer.close();
        return;
      }

      const body = await request.json();
      const { blobUrl, fileName: originalFileName, type } = body;

      if (!blobUrl || !originalFileName) {
        await sendEvent("error", { error: "No file URL provided" });
        await writer.close();
        return;
      }

      console.log(`[START] Processing ${originalFileName} from blob: ${blobUrl}`);

      // ====================
      // STEP 1: Download from Blob & Extract Text
      // ====================
      await sendEvent("progress", {
        stage: "download_and_extract",
        message: "파일 다운로드 및 텍스트 추출 중..."
      });

      // Download file from blob storage
      const blobResponse = await fetch(blobUrl);
      if (!blobResponse.ok) {
        throw new Error("Failed to download file from blob storage");
      }

      const buffer = Buffer.from(await blobResponse.arrayBuffer());
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
      const fileName = `${session.user.email}/${fileHash}.pdf`;

      // Upload to Supabase
      let fileUrl = "";
      const { error: uploadError } = await supabase.storage
        .from("materials")
        .upload(fileName, buffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("materials").getPublicUrl(fileName);
        fileUrl = publicUrlData.publicUrl;
        console.log(`[STORAGE] Uploaded PDF: ${fileUrl}`);
      } else {
        console.error("[STORAGE] Upload error:", uploadError);
        throw new Error("Failed to upload PDF");
      }

      // Extract text from PDF
      console.log('[PDF-EXTRACT] Extracting text...');
      const pdfData = await pdfParse(buffer);
      let extractedText = pdfData.text;
      const pageCount = pdfData.numpages;

      console.log(`[PDF-PARSE] Extracted ${extractedText.length} chars from ${pageCount} pages`);

      // Extract and analyze images with Google Cloud Vision
      await sendEvent("progress", {
        stage: "image_analysis",
        message: "이미지 분석 중... (Google Cloud Vision)"
      });

      console.log('[IMAGE-EXTRACT] Analyzing images...');
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const imageAnalyses = await extractAndAnalyzeImages(buffer, apiKey);
        if (imageAnalyses.length > 0) {
          const imageText = formatImageAnalysis(imageAnalyses);
          extractedText = extractedText + imageText;
          console.log(`[IMAGE-EXTRACT] Added ${imageAnalyses.length} image analyses to text`);
        } else {
          console.log('[IMAGE-EXTRACT] No images found or analyzed');
        }
      } else {
        console.warn('[IMAGE-EXTRACT] Skipping - no API key found');
      }

      // ====================
      // STEP 2: GPT-5 Mini - 스마트 청크 분할
      // ====================
      await sendEvent("progress", {
        stage: "chunking",
        message: "최적 청크로 분할 중... (GPT-5 Mini)"
      });

      console.log('[GPT-5 Mini] Smart chunking...');

      // Simple character-based chunking (균등 분할)
      const targetChunkSize = Math.ceil(extractedText.length / 3); // 3등분
      const chunks: { index: number; text: string }[] = [];

      let currentPos = 0;
      let chunkIndex = 0;

      while (currentPos < extractedText.length) {
        const endPos = Math.min(currentPos + targetChunkSize, extractedText.length);
        let actualEndPos = endPos;

        // Try to break at paragraph boundary
        if (actualEndPos < extractedText.length) {
          const nextNewline = extractedText.indexOf('\n\n', endPos - 200);
          if (nextNewline !== -1 && nextNewline < endPos + 200) {
            actualEndPos = nextNewline + 2;
          }
        }

        chunks.push({
          index: chunkIndex,
          text: extractedText.substring(currentPos, actualEndPos).trim()
        });

        currentPos = actualEndPos;
        chunkIndex++;
      }

      console.log(`[CHUNKING] Split into ${chunks.length} chunks (avg ${Math.round(extractedText.length / chunks.length)} chars each)`);

      // ====================
      // STEP 3: Save Material to DB
      // ====================
      console.log('[DB] Creating material record...');

      const material = {
        user_id: session.user.email,
        title: originalFileName.replace(/\.(pdf|txt|doc|docx)$/i, ''),
        content: extractedText.substring(0, 50000),
        type,
        file_url: fileUrl,
        file_hash: fileHash,
        analysis: {
          status: 'processing',
          approach: "smart-hybrid"
        },
        created_at: new Date().toISOString(),
      };

      const { data: insertedMaterial, error: insertError } = await supabase
        .from("materials")
        .insert(material)
        .select()
        .single();

      if (insertError) {
        console.error("[DB] Insert error:", insertError);
        throw insertError;
      }

      console.log(`[DB] Material created with ID: ${insertedMaterial.id}`);

      // ====================
      // STEP 4: GPT-5.1 순차 변환 (컨텍스트 유지)
      // ====================
      await sendEvent("progress", {
        stage: "converting",
        message: "A 모드로 변환 중... (GPT-5.1)"
      });

      console.log(`[GPT-5.1 + Mini] Converting and enhancing ${chunks.length} chunks in parallel...`);

      // Parallel conversion AND enhancement with Promise.all
      const conversionPromises = chunks.map(async (chunk, i) => {
        const conversionPrompt = `당신은 **변환기**입니다. 아래 원문을 A 모드로 압축 변환하세요.

**현재 원문** (전체 중 ${i + 1}/${chunks.length} 부분):
"""
${chunk.text}
"""

**변환 규칙 (A 모드)**:

1. **원문 문장 기준**: 원문의 문장 구조와 순서 유지
2. **문단 단위 처리**: 원문의 문단 순서 그대로 유지
3. **재해석·창작 금지**: 원문에 없는 내용 절대 추가 불가
4. **형식 변환만**:
   - 핵심 용어: **굵게**
   - 가장 중요한 용어: <mark>하이라이트</mark> (반드시 여는 태그와 닫는 태그 모두 포함)
   - 수식: 반드시 LaTeX 형식 ($x^2$ 인라인 또는 $$E=mc^2$$ 블록)
   - 표: 마크다운 표 형식으로 정확히 변환
5. **언어**:
   - 설명과 문장은 한국어로 작성
   - 전문 용어, 고유명사, 기술 용어는 영어 그대로 유지
   - 예: "**Gradient Descent**를 사용하여 손실 함수를 최소화합니다"
6. **불확실하면 원문 인용**: 해석하지 말고 원문 그대로 복사
7. **압축 강도 (매우 중요)**:
   - 목표: 원본 대비 60-65% 분량으로 압축
   - 반복 설명, 장황한 예시, 불필요한 접속사 제거
   - 핵심만 남기되 중요 내용은 절대 누락 금지
   - 같은 맥락의 여러 문장은 하나로 통합

**슬라이드 구분 (매우 중요)**:
- **슬라이드 개수**: 내용에 따라 자연스럽게 조정 (제한 없음)
- 큰 주제/섹션/개념은 \`## 제목\` 형식으로 시작하여 각각 별도 슬라이드로 구성
- **내용이 많은 경우**: 주제별로 적절히 분할하여 각각 슬라이드로 생성
- **내용이 적은 경우**: 관련 개념을 통합하여 적절한 개수로 조정
- 각 슬라이드는 하나의 완결된 주제나 개념을 담을 것
- 작은 세부 주제들은 ### 소제목으로 하나의 슬라이드 안에서 구분
- **절대 금지**: 빈 슬라이드나 의미없는 슬라이드를 만들지 말 것
- **중요**: 원본에 실제로 있는 내용만 슬라이드로 만들 것

**수식 변환 (매우 중요)**:
- 모든 수식은 LaTeX 문법으로 변환: $f(x) = x^2$, $$\\int_0^1 x dx$$
- 분수: $\\frac{a}{b}$, 제곱: $x^2$, 아래첨자: $x_i$
- 그리스 문자: $\\alpha, \\beta, \\mu, \\sigma$
- 합: $\\sum_{i=1}^n$, 적분: $\\int_a^b$
- 행렬: $$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$
- **절대 금지**: 수식을 일반 텍스트나 백틱으로 감싸기

**표 변환 규칙 (매우 매우 중요 - 반드시 지킬 것!)**:

원문에 표 형태의 데이터가 있으면 **무조건** 마크다운 표로 변환:

**올바른 예시**:

| Support | Frequency | Proportion |
| :--- | :--- | :--- |
| 차은우 | 27 | 0.54 |
| 박보검 | 23 | 0.46 |

**또 다른 예시**:

| 항목 | 값 | 비고 |
| :--- | :--- | :--- |
| 평균 | 85.3 | 상위 10% |
| 표준편차 | 12.7 | - |

**필수 규칙 (절대 지켜야 함!)**:
1. 표 위아래로 반드시 **빈 줄 2개** (줄바꿈 2번)
2. **첫 번째 행**: 헤더 (| 헤더1 | 헤더2 |)
3. **두 번째 행**: 정렬 구분선 (| :--- | :--- |) - **반드시 콜론(:) 포함하여 정렬 명시**
4. **세 번째 행부터**: 데이터 행
5. 각 셀은 **반드시** | 기호로 구분
6. 모든 행의 열 개수 **동일**하게 유지
7. **절대 금지**: 표를 "항목1: 값1, 항목2: 값2" 같은 텍스트로 변환
8. **절대 금지**: 표를 리스트나 일반 텍스트로 변환

**절대 금지**:
- ❌ 원문에 없는 설명 추가
- ❌ "개념:", "정의:" 같은 템플릿
- ❌ 외부 지식으로 보충
- ❌ 표를 일반 텍스트로 변환
- ❌ 수식을 백틱(\`)이나 일반 텍스트로 작성
- ❌ <mark> 태그를 닫지 않고 </mark>만 작성
- ❌ <mark>와 ** 볼드를 함께 사용 (예: <mark>**텍스트**</mark>) - 중요 표시는 <mark>만 사용할 것

**출력**: 마크다운 형식 (## 제목 포함, 원문 순서 유지)`;

        // GPT-5.1: Convert to A mode
        const conversionResponse = await openai.chat.completions.create({
          model: ADVANCED_MODEL,
          messages: [
            {
              role: "system",
              content: "당신은 정확한 변환 전문가입니다. 주어진 규칙을 정확히 따릅니다. 특히 표는 반드시 마크다운 표 형식으로 변환합니다."
            },
            {
              role: "user",
              content: conversionPrompt
            }
          ],
          temperature: 1.0,
          reasoning_effort: "low",
        });

        const converted = conversionResponse.choices[0].message.content!.trim();
        console.log(`[GPT-5.1] Chunk ${i + 1} converted: ${converted.length} chars`);

        // Now enhance with Mini model
        const enhancementPrompt = `당신은 시험 준비를 돕는 학습 코치입니다.

아래 학습 자료를 분석하고, 각 ## 제목 섹션 마지막에 **"### 💡 한걸음 더!"** 섹션을 추가하세요.

**중요 규칙**:
1. 원본 내용은 절대 수정하지 말고 그대로 유지
2. 각 ## 제목 섹션 끝에만 "### 💡 한걸음 더!" 추가
3. "한걸음 더!" 내용: 시험 팁, 실전 응용, 암기 요령, 자주 하는 실수 등
4. 2-3문장으로 간결하게 작성
5. **반드시 원본 자료에서 유래한 구체적인 팁만 작성**

**절대 금지**:
- ❌ "강의 노트와 연동해 확인하세요" 같은 일반적인 조언
- ❌ "교재와 대조합니다" 같은 학습 방법론
- ❌ "오타나 부족한 부분이 있으면" 같은 메타 조언
- ❌ 원본 자료와 무관한 일반론
- ❌ 빈 공간을 채우기 위한 의미없는 텍스트

**학습 자료**:
${converted}`;

        const miniResponse = await openai.chat.completions.create({
          model: MINI_MODEL,
          messages: [{ role: "user", content: enhancementPrompt }],
          temperature: 1.0,
        });

        let enhanced = miniResponse.choices[0].message.content!.trim();

        // 백틱 코드 블록 제거
        enhanced = enhanced
          .replace(/^```[a-z]*\n/gm, '')
          .replace(/\n```$/gm, '')
          .trim();

        console.log(`[Mini] Chunk ${i + 1} enhanced: ${enhanced.length} chars`);

        return { index: i, content: enhanced };
      });

      // Wait for all conversions AND enhancements to complete
      const convertedChunks = await Promise.all(conversionPromises);

      // Sort by index and join
      convertedChunks.sort((a, b) => a.index - b.index);
      let fullContent = convertedChunks.map(c => c.content).join("\n\n");

      console.log(`[PARALLEL] All chunks converted and enhanced: ${fullContent.length} total chars`);

      // Stream all content at once after parallel completion
      for (let i = 0; i < convertedChunks.length; i++) {
        await sendEvent("content", {
          content: convertedChunks[i].content,
          isComplete: false,
          progress: ((i + 1) / convertedChunks.length) * 100
        });
      }

      // Note: "한걸음 더!" 섹션은 각 청크 변환 시 이미 병렬로 추가됨
      // Note: 핵심 개념은 사용자가 "핵심 개념" 버튼 클릭 시 on-demand로 생성됩니다.

      // ====================
      // STEP 5: Update DB with final content
      // ====================
      const totalDuration = Date.now() - startTime;
      const estimatedInputTokens = chunks.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0);
      const estimatedOutputTokens = Math.ceil(fullContent.length / 4);
      const estimatedCost =
        (estimatedInputTokens / 1_000_000) * 2.50 +
        (estimatedOutputTokens / 1_000_000) * 10.00;

      const metricsSummary = {
        totalDuration,
        approach: "smart-hybrid",
        apiCalls: chunks.length,
        chunkCount: chunks.length,
        outputLength: fullContent.length,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedCost,
        pdfPages: pageCount,
        extractedTextLength: extractedText.length,
      };

      await supabase
        .from("materials")
        .update({
          analysis: {
            content: fullContent,
            metrics: metricsSummary,
            status: 'completed',
            generatedAt: new Date().toISOString(),
          }
        })
        .eq("id", insertedMaterial.id);

      console.log(`[METRICS] Complete: ${(totalDuration / 1000).toFixed(2)}s, ~$${estimatedCost.toFixed(4)}`);

      await sendEvent("complete", {
        materialId: insertedMaterial.id,
        content: fullContent,
        metrics: metricsSummary,
      });

      await writer.close();
    } catch (error: any) {
      console.error("[ERROR]", error);
      await sendEvent("error", { error: error.message });
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
