import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Parser from 'rss-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const parser = new Parser();

const MINI_MODEL = "gpt-5-mini-2025-08-07";
const BATCH_SIZE = 10; // 10개씩 병렬 처리

// RSS Feed URLs (기존 코드에서 가져옴)
const RSS_FEEDS = [
  // International Sources - News & Business
  { name: "Reuters", url: "https://www.reuters.com/rssFeed/businessNews", category: "Business", interests: ["비즈니스", "경제"] },
  { name: "Reuters Tech", url: "https://www.reuters.com/rssFeed/technologyNews", category: "Technology", interests: ["기술", "IT"] },
  { name: "AP News", url: "https://rsshub.app/apnews/topics/apf-topnews", category: "Top News", interests: ["뉴스"] },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "Business", interests: ["비즈니스", "경제"] },
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "Technology", interests: ["기술", "IT"] },
  { name: "CNN Top Stories", url: "http://rss.cnn.com/rss/cnn_topstories.rss", category: "Top Stories", interests: ["뉴스"] },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech", interests: ["기술", "스타트업", "AI"] },
  { name: "Bloomberg Markets", url: "https://feeds.bloomberg.com/markets/news.rss", category: "Business", interests: ["금융", "투자", "비즈니스"] },
  { name: "Bloomberg Economics", url: "https://feeds.bloomberg.com/economics/news.rss", category: "Economics", interests: ["경제", "금융정책"] },
  { name: "WSJ World News", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", category: "Business", interests: ["비즈니스", "경제", "금융"] },
  { name: "New York Times Economy", url: "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml", category: "Economics", interests: ["경제"] },
  { name: "New York Times AI", url: "https://www.nytimes.com/svc/collections/v1/publish/spotlight/artificial-intelligence/rss.xml", category: "AI", interests: ["AI", "기술"] },
  { name: "ESPN", url: "http://www.espn.com/espn/rss/news", category: "Sports", interests: ["스포츠"] },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", category: "Sports", interests: ["스포츠"] },
  { name: "Reuters Sports", url: "http://feeds.reuters.com/reuters/worldOfSport", category: "Sports", interests: ["스포츠"] },
  { name: "Sky Sports", url: "https://www.skysports.com/rss/11095", category: "Sports", interests: ["스포츠"] },
  { name: "한국경제", url: "https://www.hankyung.com/feed/economy", category: "경제", interests: ["경제", "비즈니스"] },
  { name: "한국경제 IT", url: "https://www.hankyung.com/feed/it", category: "IT", interests: ["IT", "기술"] },
  { name: "조선일보 경제", url: "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml", category: "경제", interests: ["경제"] },
  { name: "매일경제", url: "https://www.mk.co.kr/rss/30100041/", category: "경제", interests: ["경제", "비즈니스"] },
  { name: "매일경제 증권", url: "https://www.mk.co.kr/rss/50200011/", category: "증권", interests: ["금융", "투자", "주식"] },
];

interface RSSArticle {
  title: string;
  link: string;
  pubDate?: string;
  contentSnippet?: string;
  sourceName: string;
  category: string;
  interests: string[];
}

// Step 1: RSS 피드에서 뉴스 크롤링
async function fetchRSSArticles(): Promise<RSSArticle[]> {
  const articles: RSSArticle[] = [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  console.log(`[BATCH] Fetching from ${RSS_FEEDS.length} RSS feeds...`);

  for (const feed of RSS_FEEDS) {
    try {
      const feedData = await parser.parseURL(feed.url);
      console.log(`[BATCH] ${feed.name}: ${feedData.items?.length || 0} items`);

      feedData.items?.forEach((item) => {
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;

        // 최근 7일 이내 뉴스만
        if (pubDate && pubDate >= sevenDaysAgo) {
          articles.push({
            title: item.title || 'Untitled',
            link: item.link || '',
            pubDate: item.pubDate,
            contentSnippet: item.contentSnippet || item.content || '',
            sourceName: feed.name,
            category: feed.category,
            interests: feed.interests,
          });
        }
      });
    } catch (error) {
      console.error(`[BATCH] Error fetching ${feed.name}:`, error);
    }
  }

  console.log(`[BATCH] Total ${articles.length} articles collected`);
  return articles;
}

// Step 2: GPT-5-mini로 뉴스 요약 + 분류 (배치 병렬 처리)
async function summarizeArticlesBatch(articles: RSSArticle[], batchId: string) {
  console.log(`[BATCH] Summarizing ${articles.length} articles with ${MINI_MODEL}...`);

  const results: any[] = [];

  // 10개씩 병렬 처리
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    console.log(`[BATCH] Processing articles ${i + 1}-${Math.min(i + BATCH_SIZE, articles.length)}...`);

    const batchPromises = batch.map(async (article) => {
      try {
        const completion = await openai.chat.completions.create({
          model: MINI_MODEL,
          messages: [
            {
              role: "system",
              content: "당신은 뉴스 요약 전문가입니다. 간결하고 명확하게 한국어로 요약합니다."
            },
            {
              role: "user",
              content: `다음 뉴스를 분석해주세요:

제목: ${article.title}
출처: ${article.sourceName}
카테고리: ${article.category}
내용: ${article.contentSnippet?.substring(0, 500) || ''}

다음 JSON 형식으로 응답:
{
  "title_korean": "명확한 한국어 제목",
  "summary_korean": "핵심 내용 2-3문장 요약",
  "category": "AI|Business|Tech|Finance|Strategy|Innovation|Sports|경제|IT 중 하나",
  "interests": ["관련된", "관심사", "태그"],
  "relevance_score": 1-10 사이 점수
}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 1.0,
        });

        const result = JSON.parse(completion.choices[0].message.content || "{}");

        return {
          ...result,
          original_title: article.title,
          original_url: article.link,
          source_name: article.sourceName,
          pub_date: article.pubDate,
          content_snippet: article.contentSnippet,
          batch_id: batchId,
        };
      } catch (error) {
        console.error(`[BATCH] Error summarizing article:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(r => r !== null));

    console.log(`[BATCH] Completed ${results.length}/${articles.length}`);
  }

  return results;
}

// Step 3: Supabase에 저장
async function saveToCache(articles: any[]) {
  console.log(`[BATCH] Saving ${articles.length} articles to database...`);

  const records = articles.map(article => ({
    title: article.original_title,
    title_korean: article.title_korean,
    original_url: article.original_url,
    source_name: article.source_name,
    pub_date: article.pub_date,
    category: article.category,
    interests: article.interests || [],
    summary_korean: article.summary_korean,
    content_snippet: article.content_snippet,
    relevance_score: article.relevance_score || 5,
    batch_id: article.batch_id,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from('cached_news')
    .insert(records);

  if (error) {
    console.error('[BATCH] Error saving to database:', error);
    throw error;
  }

  console.log(`[BATCH] Successfully saved ${articles.length} articles`);
  return data;
}

// 메인 배치 작업
export async function POST(request: Request) {
  const batchId = `batch-${Date.now()}`;

  try {
    // 인증 확인 (cron job만 호출 가능)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[BATCH ${batchId}] Starting news batch job...`);

    // 배치 실행 기록 시작
    await supabase.from('news_batch_runs').insert({
      batch_id: batchId,
      status: 'running',
      started_at: new Date().toISOString(),
    });

    // Step 1: RSS 크롤링
    const rssArticles = await fetchRSSArticles();

    if (rssArticles.length === 0) {
      await supabase.from('news_batch_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: 'No articles found',
      }).eq('batch_id', batchId);

      return NextResponse.json({ error: "No articles found" }, { status: 500 });
    }

    // Step 2: GPT-5-mini로 요약
    const summarized = await summarizeArticlesBatch(rssArticles, batchId);

    // Step 3: DB 저장
    await saveToCache(summarized);

    // Step 4: 오래된 뉴스 비활성화
    const { error: deactivateError } = await supabase.rpc('deactivate_old_news');
    if (deactivateError) {
      console.error('[BATCH] Error deactivating old news:', deactivateError);
    }

    // 배치 완료 기록
    await supabase.from('news_batch_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      articles_processed: rssArticles.length,
      articles_cached: summarized.length,
    }).eq('batch_id', batchId);

    console.log(`[BATCH ${batchId}] Completed successfully`);

    return NextResponse.json({
      success: true,
      batchId,
      articlesProcessed: rssArticles.length,
      articlesCached: summarized.length,
    });

  } catch (error) {
    console.error(`[BATCH ${batchId}] Error:`, error);

    // 배치 실패 기록
    await supabase.from('news_batch_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Unknown error',
    }).eq('batch_id', batchId);

    return NextResponse.json({
      error: "Batch job failed",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
