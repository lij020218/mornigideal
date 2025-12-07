// Test POST endpoint for trend detail
async function testPostDetail() {
    const payload = {
        title: "팻 겔싱어, 연방 정부의 도움으로 무어의 법칙을 살리려 노력",
        level: "senior",
        job: "경영학과 대학생",
        originalUrl: "https://techcrunch.com/2025/12/06/test",
        summary: "테스트 요약입니다.",
        trendId: "test-id-123"
    };

    console.log('📤 Testing POST /api/trend-briefing...');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch('http://localhost:3001/api/trend-briefing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        console.log('\n📥 Response status:', response.status);

        const text = await response.text();
        console.log('\n📄 Raw response:', text);

        try {
            const data = JSON.parse(text);
            console.log('\n✅ Parsed response:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('\n❌ Could not parse as JSON');
        }

    } catch (error) {
        console.error('❌ Fetch error:', error);
    }
}

testPostDetail();
