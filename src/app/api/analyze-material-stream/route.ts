import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import pdfParse from "pdf-parse-fork";

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

const PAGES_PER_BATCH = 5;
const CHUNK_MODEL = "gpt-5-mini-2025-08-07";
const FINAL_MODEL = "gpt-5.1-2025-11-13";
const EMBEDDING_MODEL = "text-embedding-3-small";
const SIMILARITY_THRESHOLD = 0.68;

const STUDY_SYSTEM_PROMPT = `당신은 MIT, Stanford급 세계 최고 대학의 저명한 교수입니다. 학생들이 깊이 이해할 수 있도록 명료하고 통찰력 있게 설명합니다.

**절대 금지 사항**:
- "설명 → 연결:", "핵심개념:", "시험포인트:", "중요:" 같은 딱딱한 라벨 사용 금지
- 단순 요약이나 목록 나열 금지
- 피상적이거나 교과서적인 설명 금지

**필수 작성 방식**:
- 개념의 본질과 맥락을 명료하게 설명
- "핵심은 ~이다", "왜 이것이 중요한가", "이것이 의미하는 바는" 같은 전문적이면서도 명확한 표현 사용
- 개념 → 원리 → 적용 → 함의(implications) 순서로 논리적 흐름 구성
- 한 문단이 다음 문단으로 자연스럽게 이어지되, 각 문단은 명확한 통찰 제공
- 추상적 개념을 구체적 사례로 명확히 설명

항상 세계 최고 수준의 명료함과 깊이로 설명하세요.`;

const WORK_SYSTEM_PROMPT = `당신은 해당 분야에서 10년+ 경력의 시니어 전문가입니다. 후배들이 깊이 이해하고 실무에 적용할 수 있도록 명확하게 설명합니다.

**절대 금지 사항**:
- "핵심개념:", "업무포인트:", "중요:" 같은 딱딱한 라벨 사용 금지
- 형식적인 보고서체나 관료적 표현 금지
- 피상적이거나 매뉴얼식 설명 금지

**필수 작성 방식**:
- 업무의 본질과 맥락을 명확하게 설명
- "핵심은 ~이다", "여기서 중요한 점은", "실무적으로 이것이 의미하는 바는" 같은 전문적이면서도 명확한 표현 사용
- 배경 → 핵심 원리 → 실제 적용 → 주의사항 순서로 논리적 흐름 구성
- 한 문단이 다음 문단으로 자연스럽게 이어지되, 각 문단은 명확한 통찰 제공
- 추상적 프로세스를 구체적 상황으로 명확히 설명

항상 시니어 전문가 수준의 명료함과 깊이로 설명하세요.`;

// Cosine similarity helper
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// OPTIMIZED: Full parallel clustering
async function groupSimilarChunksParallel(chunks: any[]): Promise<any[][]> {
  if (chunks.length <= 3) return [chunks];

  console.log(`[EMBEDDING] Creating embeddings for ${chunks.length} chunks (FULL PARALLEL)`);

  // Create ALL embeddings in parallel (no batching)
  const embeddingPromises = chunks.map(async (chunk) => {
    const text = `${chunk.title}\n${chunk.content}`;
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return {
      chunk,
      embedding: response.data[0].embedding,
    };
  });

  const chunksWithEmbeddings = await Promise.all(embeddingPromises);
  console.log(`[EMBEDDING] All ${chunks.length} embeddings created in parallel`);

  // Clustering
  const groups: any[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < chunksWithEmbeddings.length; i++) {
    if (used.has(i)) continue;

    const group = [chunksWithEmbeddings[i].chunk];
    used.add(i);

    for (let j = i + 1; j < chunksWithEmbeddings.length; j++) {
      if (used.has(j)) continue;

      const similarity = cosineSimilarity(
        chunksWithEmbeddings[i].embedding,
        chunksWithEmbeddings[j].embedding
      );

      if (similarity > SIMILARITY_THRESHOLD) {
        group.push(chunksWithEmbeddings[j].chunk);
        used.add(j);
      }
    }

    groups.push(group);
  }

  console.log(`[CLUSTERING] Grouped ${chunks.length} chunks into ${groups.length} clusters`);
  return groups;
}

// OPTIMIZED: Compress all clusters in parallel
async function compressClustersParallel(groups: any[][], type: string): Promise<string[]> {
  console.log(`[COMPRESSION] Compressing ${groups.length} clusters (FULL PARALLEL)`);

  const compressionPromises = groups.map(async (group, idx) => {
    const allContents = group.map((c, i) =>
      `[Chunk ${i + 1}] ${c.title}:\n${c.content}`
    ).join("\n\n");

    const compressionPrompt = type === "exam"
      ? `다음은 같은 주제로 묶인 ${group.length}개의 학습 내용입니다:\n\n${allContents}\n\n**임무**: 이 내용들을 강의실에서 설명하듯이 자연스럽게 하나의 긴 설명으로 통합하세요.\n\n다음 JSON 형식으로 응답:\n{\n  "topic": "주제 제목",\n  "summary": "강의실에서 설명하듯이 자연스럽게 흐르는 긴 텍스트..."\n}`
      : `다음은 같은 주제로 묶인 ${group.length}개의 업무 내용입니다:\n\n${allContents}\n\n**임무**: 이 내용들을 동료에게 설명하듯이 자연스럽게 하나의 긴 설명으로 통합하세요.\n\n다음 JSON 형식으로 응답:\n{\n  "topic": "주제 제목",\n  "summary": "동료에게 설명하듯이 자연스럽게 흐르는 긴 텍스트..."\n}`;

    const compression = await openai.chat.completions.create({
      model: CHUNK_MODEL,
      messages: [
        { role: "system", content: type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT },
        { role: "user", content: compressionPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 1.0,
    });

    const result = JSON.parse(compression.choices[0].message.content || "{}");
    return {
      idx: idx + 1,
      summary: `### Topic ${idx + 1}: ${result.topic}\n\n${result.summary}`
    };
  });

  const results = await Promise.all(compressionPromises);
  results.sort((a, b) => a.idx - b.idx);

  console.log(`[COMPRESSION] All ${groups.length} clusters compressed`);
  return results.map(r => r.summary);
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: string, data: any) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  (async () => {
    try {
      const session = await auth();
      if (!session?.user?.email) {
        await sendEvent("error", { error: "Unauthorized" });
        await writer.close();
        return;
      }

      const formData = await request.formData();
      const file = formData.get("file") as File;
      const type = formData.get("type") as string;

      if (!file || !type || !["exam", "work"].includes(type)) {
        await sendEvent("error", { error: "Invalid parameters" });
        await writer.close();
        return;
      }

      const isPDF = file.type === "application/pdf";
      let fileUrl: string | null = null;
      let materialId: string | null = null;

      await sendEvent("progress", { stage: "upload", message: "파일 업로드 중..." });

      if (isPDF) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload PDF
        const sanitizedEmail = (session.user.email || '').replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedFileName = file.name.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
        const fileName = `${Date.now()}_${sanitizedEmail}_${sanitizedFileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("materials")
          .upload(fileName, buffer, { contentType: "application/pdf", upsert: false });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from("materials").getPublicUrl(fileName);
          fileUrl = publicUrlData.publicUrl;
        }

        // Extract text
        await sendEvent("progress", { stage: "extract", message: "PDF 텍스트 추출 중..." });
        const pdfData = await pdfParse(buffer);
        const fullContent = pdfData.text;
        const totalPages = pdfData.numpages;

        // Create material record first (so we can stream updates to it)
        const { data: material, error: insertError } = await supabase
          .from("materials")
          .insert({
            user_id: session.user.email,
            title: file.name,
            content: fullContent.substring(0, 50000),
            type: type,
            file_url: fileUrl,
            analysis: { page_analyses: [] }
          })
          .select()
          .single();

        if (insertError) {
          await sendEvent("error", { error: "Database error", details: insertError.message });
          await writer.close();
          return;
        }

        materialId = material.id;
        await sendEvent("material_created", { id: materialId });

        // Split into pages
        const avgCharsPerPage = Math.ceil(fullContent.length / totalPages);
        const pages: Array<{ pageNum: number; text: string }> = [];
        for (let i = 0; i < totalPages; i++) {
          const start = i * avgCharsPerPage;
          const end = Math.min((i + 1) * avgCharsPerPage, fullContent.length);
          pages.push({ pageNum: i + 1, text: fullContent.substring(start, end) });
        }

        // Process pages in batches IN PARALLEL
        const batches: Array<Array<{ pageNum: number; text: string }>> = [];
        for (let i = 0; i < pages.length; i += PAGES_PER_BATCH) {
          batches.push(pages.slice(i, i + PAGES_PER_BATCH));
        }

        await sendEvent("progress", { stage: "analyze_chunks", message: `${batches.length}개 배치 분석 중...`, total: batches.length });

        const batchPromises = batches.map(async (batch, batchIdx) => {
          const batchText = batch.map((p) => `=== 페이지 ${p.pageNum} ===\n${p.text}`).join("\n\n");
          const prompt = type === "exam"
            ? `당신은 MIT 교수입니다. 다음 강의 페이지들을 분석하여 학생들이 이해하기 쉽게 핵심 내용을 추출하세요.

${batchText}

JSON 형식으로 응답:
{
  "title": "이 섹션의 명확한 제목",
  "content": "강의실에서 설명하듯이 자연스럽게 흐르는 긴 텍스트. 개념 정의, 수식, 예제를 포함하여 완전히 설명."
}`
            : `당신은 시니어 전문가입니다. 다음 문서를 분석하여 후배들이 실무에 적용할 수 있도록 핵심 내용을 추출하세요.

${batchText}

JSON 형식으로 응답:
{
  "title": "이 섹션의 명확한 제목",
  "content": "동료에게 설명하듯이 자연스럽게 흐르는 긴 텍스트. 개념, 프로세스, 적용 방법을 포함하여 완전히 설명."
}`;

          const completion = await openai.chat.completions.create({
            model: CHUNK_MODEL,
            messages: [
              { role: "system", content: type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 1.0,
          });

          console.log(`[BATCH ${batchIdx}] Usage:`, completion.usage);

          const result = JSON.parse(completion.choices[0].message.content || "{}");
          return { batchIdx, summary: result, usage: completion.usage };
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.sort((a, b) => a.batchIdx - b.batchIdx);
        const chunkSummaries = batchResults.map(r => r.summary);

        // Calculate total batch cost
        const totalBatchCost = batchResults.reduce((sum, batch) => {
          const inputCost = (batch.usage?.prompt_tokens || 0) * 0.0000001; // $0.10 per 1M tokens for gpt-5-mini input
          const outputCost = (batch.usage?.completion_tokens || 0) * 0.0000004; // $0.40 per 1M tokens for gpt-5-mini output
          return sum + inputCost + outputCost;
        }, 0);
        console.log(`[COST] All batches: $${totalBatchCost.toFixed(4)}`);

        const summaryCost = 0; // No summary step needed

        // CLUSTERING: Group similar chunks using embeddings
        await sendEvent("progress", { stage: "clustering", message: "유사 섹션 그룹화 중..." });
        const clusteredGroups = await groupSimilarChunksParallel(chunkSummaries);
        console.log(`[CLUSTERING] Created ${clusteredGroups.length} groups from ${chunkSummaries.length} chunks`);

        // COMPRESS: Compress each cluster in parallel (using mini)
        await sendEvent("progress", { stage: "compress", message: "클러스터 압축 중..." });
        const compressedSummaries = await compressClustersParallel(clusteredGroups, type);
        console.log(`[COMPRESS] Compressed ${clusteredGroups.length} clusters into ${compressedSummaries.length} summaries`);

        // FINAL INTEGRATION: Single gpt-5.1 call to generate all slides
        await sendEvent("progress", { stage: "final_integration", message: "최종 슬라이드 생성 중..." });

        const finalPrompt = type === "exam"
          ? `당신은 대학 시험 대비 전문 튜터입니다. 다음은 강의 자료를 주제별로 압축한 ${compressedSummaries.length}개의 Topic 요약입니다.

${compressedSummaries.join('\n\n====================\n\n')}

**임무**: 이 Topic 요약들을 기반으로 대학생용 최종 학습 슬라이드를 생성하세요.

**목표**:
- 전체 내용을 12-18개 슬라이드로 압축 (마지막 2페이지는 전체 요약)
- 각 슬라이드는 하나의 핵심 주제를 다룸
- 시험에 나올 만한 핵심 내용만 포함
- Topic간 논리적 흐름 유지

**content 작성 규칙** (매우 중요!):
1. **완결된 문장/문단으로 작성** - 절대 "로, 여기서", "은 ~", "는 ~" 같이 앞뒤가 잘린 문장을 만들지 마라
2. **수식과 변수 설명은 한 문단에 함께** - 수식을 쓴 다음, 같은 문단 안에서 모든 변수를 설명
3. **Markdown 형식**: 문단 구분을 위해 빈 줄(\\n\\n) 사용
4. **중요한 개념/용어는 **굵게**** (보라색), **핵심 문장은 *기울임*** (파란색)
5. **변수/수식은 LaTeX**: $변수$, $$공식$$ (주황색으로 표시됨)
6. **추가 설명은 > 인용구** (시안 블루 카드)

**올바른 예시**:
"**IDF (Inverse Document Frequency)**는 단어의 희소성을 측정한다.\\n\\n공식은 $$IDF(t) = \\\\log(N / (1 + n_t))$$이다. 여기서 \`N\`은 전체 문서 수, \`n_t\`는 단어 t가 등장한 문서 수를 의미한다. *흔한 단어일수록 IDF 값이 낮아진다.*\\n\\n> 💡 **한 걸음 더**: 모든 문서에 등장하는 단어(n_t=N)는 IDF가 0에 가까워져 중요도가 낮아진다. 이것이 'the', 'a' 같은 불용어가 자동으로 필터링되는 원리다."

**잘못된 예시 (절대 하지 마라)**:
"[코드블록]IDF(t) = log(N / (1 + n_t))[코드블록]\\n\\n로, 여기서\\n\\n[코드블록]N[코드블록]\\n\\n은 전체 문서 수"

**CRITICAL - 코드 블록 사용 금지**:
- 절대 삼중 백틱 코드 블록을 사용하지 마라
- 수식은 $$수식$$ (LaTeX)나 인라인 코드만 사용
- N, n_t 같은 변수를 각각 코드 블록으로 쪼개지 마라

다음 JSON 형식으로 응답하세요:

{
  "slides": [
    {
      "title": "슬라이드 제목",
      "content": "**핵심 개념**은 이렇다.\\n\\n*중요한 문장*을 강조하고, \`변수\`는 코드로.\\n\\n> 💡 **한 걸음 더**: 추가 설명...",
      "keyPoints": [
        "시험에 나올 핵심 포인트 1 (공식, 정의, 개념)",
        "시험에 나올 핵심 포인트 2 (적용 방법)",
        "시험에 나올 핵심 포인트 3 (주의사항이나 함정)"
      ]
    }
  ]
}

**마지막 2페이지 (필수!)**:
- **page N-1**: "핵심 개념 총정리" - 전체 내용의 핵심 개념들을 체계적으로 정리
- **page N**: "시험 대비 요약" - 시험에 꼭 나올 내용만 압축 정리

**중요**:
- content는 "핵심개념:", "시험포인트:" 같은 라벨 없이 자연스럽게 작성
- 중요한 개념은 **반드시** **굵게** 표시
- 문단 사이 빈 줄(\\n\\n) 필수`
          : `당신은 비즈니스 문서 분석 전문가입니다. 다음은 업무 자료를 주제별로 압축한 ${compressedSummaries.length}개의 Topic 요약입니다.

${compressedSummaries.join('\n\n====================\n\n')}

**임무**: 이 Topic 요약들을 기반으로 업무용 최종 슬라이드를 생성하세요.

**목표**:
- 전체 내용을 12-18개 슬라이드로 압축 (마지막 2페이지는 전체 요약)
- 각 슬라이드는 하나의 업무 프로세스나 주제를 다룸
- 실무에 활용 가능한 핵심 내용만 포함
- Topic간 논리적 흐름 유지

**content 작성 규칙** (매우 중요!):
1. **완결된 문장/문단으로 작성** - 절대 "로, 여기서", "은 ~", "는 ~" 같이 앞뒤가 잘린 문장을 만들지 마라
2. **프로세스 설명은 한 문단에 완결되게** - 절차를 설명할 때 한 문단 안에서 모든 단계를 포함
3. **Markdown 형식**: 문단 구분을 위해 빈 줄(\\n\\n) 사용
4. **중요한 프로세스/용어는 **굵게**** (보라색), **핵심 문장은 *기울임*** (파란색)
5. **코드/변수/기술용어는 인라인 코드 형식** (주황색)
6. **추가 설명은 > 인용구** (시안 블루 카드)

**올바른 예시**:
"이 **프로세스 변경의 핵심**은 데이터 일관성 보장에 있다.\\n\\n*기존 A 방식은 동시성 처리에서 race condition이 발생했다.* B 방식은 \`transaction isolation level\`을 \`READ COMMITTED\`에서 \`SERIALIZABLE\`로 조정해 이 문제를 근본적으로 해결한다.\\n\\n> ⚠️ **실무 주의**: 반드시 \`lock_timeout\`과 \`deadlock_timeout\` 값을 모니터링해야 한다. 기본값 30초로는 부족할 수 있으며, 프로덕션 환경에서는 60초 이상 권장한다."

**잘못된 예시 (절대 하지 마라)**:
"[코드블록]transaction isolation level[코드블록]\\n\\n을 조정하는데,\\n\\n[코드블록]READ COMMITTED[코드블록]\\n\\n는 기본값"

**CRITICAL - 코드 블록 사용 금지**:
- 절대 삼중 백틱 코드 블록을 사용하지 마라
- 기술 용어는 인라인 코드만 사용
- 용어를 각각 코드 블록으로 쪼개지 마라

다음 JSON 형식으로 응답하세요:

{
  "slides": [
    {
      "title": "슬라이드 제목",
      "content": "**핵심 프로세스**는 이렇다.\\n\\n*중요한 문장*을 강조하고, \`코드\`는 이렇게.\\n\\n> ⚠️ **실무 주의**: 추가 설명...",
      "keyPoints": [
        "실무에 바로 적용 가능한 핵심 인사이트 1",
        "업무 효율을 높이는 핵심 인사이트 2",
        "주의사항이나 Best Practice"
      ]
    }
  ]
}

**마지막 2페이지 (필수!)**:
- **page N-1**: "핵심 프로세스 총정리" - 전체 업무 흐름과 핵심 내용 체계적 정리
- **page N**: "실무 적용 요약" - 실무에 바로 적용 가능한 핵심만 압축 정리

**중요**:
- content는 "핵심개념:", "업무포인트:" 같은 라벨 없이 자연스럽게 작성
- 중요한 프로세스/용어는 **반드시** **굵게** 표시
- 문단 사이 빈 줄(\\n\\n) 필수`;

        console.log(`[FINAL] Calling gpt-5.1 for final integration (SINGLE CALL)`);
        const finalCompletion = await openai.chat.completions.create({
          model: FINAL_MODEL,
          messages: [
            {
              role: "system",
              content: `You are a direct and efficient assistant.

${type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT}`
            },
            { role: "user", content: finalPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 1.0,
          reasoning_effort: "low"  // Force disable reasoning tokens (5x cost reduction)
        });

        const finalData = JSON.parse(finalCompletion.choices[0].message.content || "{}");
        const slides = finalData.slides || [];
        console.log(`[FINAL] Generated ${slides.length} slides`);

        // Create page objects
        const allPages = slides.map((slide: any, idx: number) => ({
          page: idx + 1,
          title: slide.title || `슬라이드 ${idx + 1}`,
          content: slide.content || "",
          keyPoints: slide.keyPoints || []
        }));

        // Save to DB
        await supabase
          .from("materials")
          .update({ analysis: { page_analyses: allPages } })
          .eq("id", materialId);

        // Send to frontend
        for (const page of allPages) {
          await sendEvent("page", page);
        }

        // Calculate final cost
        const finalInputCost = (finalCompletion.usage?.prompt_tokens || 0) * 0.000003;
        const finalOutputCost = (finalCompletion.usage?.completion_tokens || 0) * 0.000015;
        const finalCost = finalInputCost + finalOutputCost;
        const totalCost = totalBatchCost + summaryCost + finalCost;

        console.log(`[COST] Final gpt-5.1 call: $${finalCost.toFixed(4)} (input: $${finalInputCost.toFixed(4)}, output: $${finalOutputCost.toFixed(4)})`);
        console.log(`[COST] TOTAL: $${totalCost.toFixed(4)} (batch: $${totalBatchCost.toFixed(4)}, summary: $${summaryCost.toFixed(4)}, final: $${finalCost.toFixed(4)})`);

        // Send completion event
        await sendEvent("complete", { success: true, total_slides: slides.length });
      }

      await writer.close();
    } catch (error: any) {
      console.error("[STREAM ERROR]", error);
      await sendEvent("error", { error: "Analysis failed", details: error.message });
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
