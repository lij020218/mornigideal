// Test script to check trend briefing detail API response
async function testTrendDetail() {
    const testPayload = {
        title: "테스트 뉴스 제목",
        level: "중급",
        job: "마케터",
        originalUrl: "https://example.com/test",
        summary: "이것은 테스트 요약입니다.",
        trendId: "test-trend-id-123"
    };

    console.log('📤 Sending request to /api/trend-briefing...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));

    try {
        const response = await fetch('http://localhost:3001/api/trend-briefing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload)
        });

        console.log('\n📥 Response status:', response.status);

        if (!response.ok) {
            console.error('❌ Response not OK:', response.statusText);
            return;
        }

        const data = await response.json();
        console.log('\n✅ Response data:');
        console.log(JSON.stringify(data, null, 2));

        // Check structure
        console.log('\n🔍 Checking structure:');
        console.log('- Has detail:', !!data.detail);
        console.log('- Has title:', !!data.detail?.title);
        console.log('- Has content:', !!data.detail?.content);
        console.log('- keyTakeaways type:', Array.isArray(data.detail?.keyTakeaways) ? 'array' : typeof data.detail?.keyTakeaways);
        console.log('- keyTakeaways length:', data.detail?.keyTakeaways?.length || 0);
        console.log('- actionItems type:', Array.isArray(data.detail?.actionItems) ? 'array' : typeof data.detail?.actionItems);
        console.log('- actionItems length:', data.detail?.actionItems?.length || 0);

        if (data.detail?.keyTakeaways) {
            console.log('\n💡 Key Takeaways:');
            data.detail.keyTakeaways.forEach((item: string, i: number) => {
                console.log(`  ${i + 1}. ${item}`);
            });
        }

        if (data.detail?.actionItems) {
            console.log('\n🎯 Action Items:');
            data.detail.actionItems.forEach((item: string, i: number) => {
                console.log(`  ${i + 1}. ${item}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testTrendDetail();
