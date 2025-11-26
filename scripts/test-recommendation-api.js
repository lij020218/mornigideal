// Native fetch is available in Node.js 18+

async function testAPI() {
    try {
        const response = await fetch('http://localhost:3000/api/recommendations/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job: 'Software Engineer',
                goal: 'Become a Senior Developer',
                interests: ['React', 'System Design'],
                exclude: []
            })
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Raw Output:', text);

        if (response.ok) {
            try {
                const json = JSON.parse(text);
                console.log('Parsed JSON:', JSON.stringify(json, null, 2));
            } catch (e) {
                console.error('JSON Parse Error:', e.message);
            }
        }
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

testAPI();
