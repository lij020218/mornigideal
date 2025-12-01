import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // user email
    const error = searchParams.get("error");

    // Return HTML that will close the popup and send message to parent
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Gmail 연동 중...</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            background: rgba(255, 0, 0, 0.2);
            padding: 1rem;
            border-radius: 8px;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2 id="status">Gmail 계정 연동 중...</h2>
        <p id="message">잠시만 기다려주세요</p>
    </div>

    <script>
        (async function() {
            const code = ${JSON.stringify(code)};
            const userEmail = ${JSON.stringify(state)};
            const error = ${JSON.stringify(error)};

            console.log('[Gmail Callback] code:', code ? 'exists' : 'missing');
            console.log('[Gmail Callback] userEmail:', userEmail);
            console.log('[Gmail Callback] error:', error);
            console.log('[Gmail Callback] window.opener:', window.opener ? 'exists' : 'missing');

            if (error) {
                document.getElementById('status').textContent = '연동 실패';
                document.getElementById('message').innerHTML = '<div class="error">OAuth 인증이 취소되었거나 실패했습니다: ' + error + '</div>';

                // Send error to parent
                if (window.opener) {
                    console.log('[Gmail Callback] Sending error to parent');
                    window.opener.postMessage({
                        type: 'gmail-link-error',
                        error: error
                    }, '*');
                } else {
                    console.error('[Gmail Callback] No window.opener!');
                }

                setTimeout(() => window.close(), 3000);
                return;
            }

            if (!code || !userEmail) {
                document.getElementById('status').textContent = '연동 실패';
                document.getElementById('message').innerHTML = '<div class="error">인증 정보가 없습니다.<br>code=' + (code ? 'ok' : 'missing') + '<br>email=' + (userEmail || 'missing') + '</div>';
                setTimeout(() => window.close(), 3000);
                return;
            }

            try {
                console.log('[Gmail Callback] Exchanging code for tokens...');
                // Exchange code for tokens via our API
                const response = await fetch('/api/auth/link-gmail', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code, userEmail }),
                });

                const data = await response.json();
                console.log('[Gmail Callback] API response:', response.ok, data);

                if (response.ok) {
                    document.getElementById('status').textContent = '✓ 연동 완료!';
                    document.getElementById('message').textContent = data.gmailEmail + ' 계정이 연동되었습니다.';

                    // Send success message to parent window
                    if (window.opener && !window.opener.closed) {
                        console.log('[Gmail Callback] Sending success to parent');
                        window.opener.postMessage({
                            type: 'gmail-link-success',
                            data: data
                        }, '*');
                        console.log('[Gmail Callback] Message sent!');
                    } else {
                        console.error('[Gmail Callback] window.opener is null or closed!');
                        alert('연동이 완료되었습니다! 이 창을 닫고 페이지를 새로고침해주세요.');
                    }

                    // Close popup after 2 seconds
                    setTimeout(() => {
                        console.log('[Gmail Callback] Closing popup...');
                        window.close();
                    }, 2000);
                } else {
                    throw new Error(data.error || data.message || '연동 실패');
                }
            } catch (err) {
                console.error('[Gmail Callback] Error:', err);
                document.getElementById('status').textContent = '연동 실패';
                document.getElementById('message').innerHTML = '<div class="error">' + err.message + '</div>';

                // Send error to parent
                if (window.opener) {
                    window.opener.postMessage({
                        type: 'gmail-link-error',
                        error: err.message
                    }, '*');
                }

                setTimeout(() => window.close(), 3000);
            }
        })();
    </script>
</body>
</html>
    `;

    return new NextResponse(html, {
        headers: {
            "Content-Type": "text/html",
        },
    });
}
