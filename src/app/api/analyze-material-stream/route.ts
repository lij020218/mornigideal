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
        // 유니코드 아래첨자를 일반 문자로 정규화
        const normalizeSubscripts = (text: string): string => {
          // 유니코드 아래첨자 숫자 → 일반 숫자
          const subscriptDigits: Record<string, string> = {
            '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
            '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
          };

          // 유니코드 아래첨자 문자 → 일반 문자
          const subscriptLetters: Record<string, string> = {
            'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₕ': 'h',
            'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₚ': 'p',
            'ₛ': 's', 'ₜ': 't', 'ᵢ': 'i', 'ᵣ': 'r', 'ᵤ': 'u',
            'ᵥ': 'v', 'ⱼ': 'j'
          };

          let normalized = text;

          // 숫자 아래첨자 치환
          Object.entries(subscriptDigits).forEach(([unicode, normal]) => {
            normalized = normalized.replace(new RegExp(unicode, 'g'), normal);
          });

          // 문자 아래첨자 치환
          Object.entries(subscriptLetters).forEach(([unicode, normal]) => {
            normalized = normalized.replace(new RegExp(unicode, 'g'), normal);
          });

          return normalized;
        };

        const normalizedText = normalizeSubscripts(chunk.text);

        const conversionPrompt = `당신은 **변환기**입니다. 아래 원문을 A 모드로 압축 변환하세요.

**현재 원문** (전체 중 ${i + 1}/${chunks.length} 부분):
"""
${normalizedText}
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

**제목 작성 규칙 (매우 매우 중요 - 반드시 지킬 것!)**:
- **깔끔한 제목만 사용**: "Futures Markets (Introduction)" ✅
- **절대 금지 - 다음은 모두 제거**:
  - ❌ "Lecture 12: Futures Markets" → "Futures Markets" ✅
  - ❌ "Chapter 3: Introduction" → "Introduction" ✅
  - ❌ "Section 2.1: Basic Concepts" → "Basic Concepts" ✅
  - ❌ "1. Derivatives Overview" → "Derivatives Overview" ✅
  - ❌ "<mark>Futures</mark> Markets" → "Futures Markets" ✅
  - ❌ **HTML 태그 절대 사용 금지** (<mark>, <strong>, <em> 등)
  - ❌ "Lecture N:", "Chapter N:", "Section N:" 같은 접두어
  - ❌ 숫자로 시작 (1., 2.1, 3-2 등)
- **올바른 예시**:
  - ✅ "Futures Markets"
  - ✅ "Spot-Futures Parity"
  - ✅ "Cost of Carry Model"
  - ✅ "Hedging Strategies"

**수식 변환 (매우 매우 중요 - 반드시 지킬 것!)**:

**핵심 원칙**: 원문의 모든 수식, 공식, 수학적 표현은 **100% LaTeX 형식**으로 변환!

**LaTeX 문법 예시**:
1. **인라인 수식** (문장 안): $F_0 = S_0(1 + r_f - d)^T$
2. **블록 수식** (독립 행): $$F_0 = S_0(1 + r_f - d)^T$$
3. **분수**: $\\frac{a}{b}$, $\\frac{numerator}{denominator}$
4. **거듭제곱**: $x^2$, $e^{-x}$, $(1+r)^T$
5. **아래첨자 (매우 중요!)**:
   - 숫자 아래첨자: $F_0$, $S_0$, $x_1$, $x_2$ (underscore 뒤에 숫자)
   - 문자 아래첨자: $r_f$, $r_d$, $x_i$, $x_n$ (underscore 뒤에 영문자)
   - **절대 금지**: $F_!$, $S_!$, $r_"#$ (특수문자 사용 금지!)
6. **숫자 표기 (매우 중요!)**:
   - 천 단위 구분 쉼표는 그대로 유지: $1,894$, $3.00$
   - **절대 금지**: $1{,}894$ (잘못된 LaTeX 문법)
7. **그리스 문자**: $\\alpha$, $\\beta$, $\\mu$, $\\sigma$, $\\pi$
8. **합/적분**: $\\sum_{i=1}^n x_i$, $\\int_a^b f(x)dx$
9. **행렬**: $$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$
10. **제곱근**: $\\sqrt{x}$, $\\sqrt[n]{x}$
11. **극한**: $\\lim_{x \\to \\infty}$

**변환 예시**:

**원문**: "The spot-futures parity formula is F0 = S0(1 + rf - d)^T"
**올바른 변환**: "spot-futures parity 공식은 $F_0 = S_0(1 + r_f - d)^T$ 입니다"
**주의**: F0 → F_0 (zero), S0 → S_0 (zero), rf → r_f (letter f)

**원문**: "If d < rf, futures prices exceed spot prices"
**올바른 변환**: "$d < r_f$인 경우, 선물 가격이 현물 가격을 초과합니다"

**원문**: "Calculate: x = (a+b)/c"
**올바른 변환**: "계산: $x = \\frac{a+b}{c}$"

**원문**: "E = mc^2"
**올바른 변환**: "$E = mc^2$"

**원문**: "$1,894 - $1,891 = $3.00"
**올바른 변환**: "$1,894 - $1,891 = $3.00$"
**주의**: 쉼표를 {,}로 변환하지 말 것!

**절대 금지**:
- ❌ 백틱 사용: \`F0 = S0(1 + rf - d)^T\`
- ❌ 일반 텍스트: "F0 = S0(1 + rf - d)^T"
- ❌ 코드 블록: \`\`\`F0 = S0(1 + rf - d)^T\`\`\`
- ❌ HTML: <code>F0 = S0(1 + rf - d)^T</code>

**반드시 사용**:
- ✅ 인라인: $F_0 = S_0(1 + r_f - d)^T$
- ✅ 블록: $$F_0 = S_0(1 + r_f - d)^T$$

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
              content: "당신은 정확한 변환 전문가입니다. 주어진 규칙을 정확히 따릅니다. 특히:\n1. 모든 수식/공식은 100% LaTeX 형식으로 변환 ($...$, $$...$$)\n2. 표는 반드시 마크다운 표 형식으로 변환\n3. 백틱(`)이나 일반 텍스트로 수식을 절대 작성하지 않음"
            },
            {
              role: "user",
              content: conversionPrompt
            }
          ],
          temperature: 1.0,
          reasoning_effort: "low",
        });

        let converted = conversionResponse.choices[0].message.content!.trim();
        console.log(`[GPT-5.1] Chunk ${i + 1} converted: ${converted.length} chars`);

        // 잘못된 LaTeX 쉼표 표기법 수정 (1{,}894 → 1,894)
        converted = converted.replace(/(\d)\{,\}(\d)/g, '$1,$2');

        // 수식 검증 단계: 백틱이나 일반 텍스트로 된 수식 감지 및 수정
        const hasInvalidMath = /`[^`]*(?:[=+\-*/^_]|\\frac|\\sum|\\int)[^`]*`/.test(converted) ||
                              /(?:^|[^$])[A-Z]_?\d?\s*=\s*[^$\n]{3,}(?:[+\-*/^]|\\)/.test(converted) ||
                              /_[!"#$%&'()]/.test(converted) || // 잘못된 아래첨자 감지 (예: F_!, S_!, r_"#)
                              /\$[^$]*_[!"#$%&'()][^$]*\$/.test(converted); // LaTeX 내부의 잘못된 아래첨자

        if (hasInvalidMath) {
          console.log(`[MATH-FIX] Chunk ${i + 1} has invalid math formatting, fixing...`);

          const mathFixPrompt = `다음 텍스트에서 수식이 잘못 표현되어 있습니다. 모든 수식을 LaTeX 형식으로 수정하세요.

**원본 텍스트**:
${converted}

**수정 규칙**:
1. 백틱(\`)으로 감싼 수식 → LaTeX ($...$)로 변환
2. 일반 텍스트 수식 → LaTeX로 변환
3. **잘못된 아래첨자 수정 (매우 중요!)**:
   - F_! → F_0 (숫자 0)
   - S_! → S_0 (숫자 0)
   - r_"# → r_f (문자 f)
   - d < r_"# → $d < r_f$
4. 예시:
   - \`F0 = S0(1 + rf - d)^T\` → $F_0 = S_0(1 + r_f - d)^T$
   - $F_! = S_!(1 + r_"#)$ → $F_0 = S_0(1 + r_f)$
   - E = mc^2 → $E = mc^2$
5. 나머지 내용은 그대로 유지

**출력**: 수식만 수정된 전체 텍스트`;

          const mathFixResponse = await openai.chat.completions.create({
            model: MINI_MODEL,
            messages: [{
              role: "system",
              content: "당신은 수식 표기법 전문가입니다. 모든 수학 표현을 LaTeX 형식으로 변환합니다."
            }, {
              role: "user",
              content: mathFixPrompt
            }],
            temperature: 1.0,
          });

          converted = mathFixResponse.choices[0].message.content!.trim();
          console.log(`[MATH-FIX] Chunk ${i + 1} math fixed`);
        }

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

      // ====================
      // STEP 6: Generate Core Concepts (Background)
      // ====================
      console.log('[CONCEPTS] Starting background generation...');

      
      // Generate concepts in background without blocking response
      (async () => {
        try {
          const conceptsPrompt = type === "exam"
            ? `다음은 시험 대비 학습 자료입니다. 핵심 개념을 추출하여 정리해주세요.

**학습 자료 내용**:
${fullContent.substring(0, 30000)}

**목표**: 시험에 꼭 나올 핵심 개념만 엄선하여 정리

**추출 규칙**:
1. **개념 개수**: 8-12개 (많지 않게)
2. **각 개념 구조**:
   - **제목**: 핵심 키워드 (3-5단어)
   - **정의**: 1-2문장으로 명확하게
   - **핵심 포인트**: 시험에 나올 중요 사항 2-3개
   - **예시/공식**: 있다면 LaTeX 형식으로
3. **절대 금지**: 원문에 없는 내용 추가, 일반적인 조언

**출력 형식** (마크다운):

## 개념 1: 제목

**정의**: 간단명료한 정의

**핵심 포인트**:
- 포인트 1
- 포인트 2
- 포인트 3

**공식/예시**: (있다면)

---

(다음 개념 반복)`
            : `다음은 업무 자료입니다. 핵심 개념을 추출하여 정리해주세요.

**업무 자료 내용**:
${fullContent.substring(0, 30000)}

**목표**: 업무에 꼭 필요한 핵심 개념만 정리

**추출 규칙**:
1. **개념 개수**: 8-12개
2. **각 개념 구조**:
   - **제목**: 핵심 키워드
   - **설명**: 실무에서 어떻게 사용되는지
   - **주요 사항**: 주의할 점, 중요 프로세스
   - **예시**: 있다면 구체적으로
3. **절대 금지**: 원문에 없는 내용 추가

**출력 형식** (마크다운):

## 개념 1: 제목

**설명**: 간단명료한 설명

**주요 사항**:
- 사항 1
- 사항 2
- 사항 3

**예시**: (있다면)

---

(다음 개념 반복)`;

          const conceptsResponse = await openai.chat.completions.create({
            model: MINI_MODEL,
            messages: [{ role: "user", content: conceptsPrompt }],
            temperature: 1.0,
          });

          const conceptsContent = conceptsResponse.choices[0].message.content!.trim()
            .replace(/^```[a-z]*\n/gm, '')
            .replace(/\n```$/gm, '')
            .trim();

          // Get current analysis first
          const { data: currentMaterial } = await supabase
            .from("materials")
            .select("analysis")
            .eq("id", insertedMaterial.id)
            .single();

          await supabase
            .from("materials")
            .update({
              analysis: {
                ...(currentMaterial?.analysis || {}),
                concepts_content: conceptsContent,
              }
            })
            .eq("id", insertedMaterial.id);

          console.log('[CONCEPTS] Background generation completed');
        } catch (error) {
          console.error('[CONCEPTS] Background generation failed:', error);
          // Don't block main flow if concepts generation fails
        }
      })();

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
