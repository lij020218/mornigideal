import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // user email
  const error = searchParams.get("error");

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>슬랙 연동 중...</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #611f69 0%, #4a154b 100%);
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
        <h2 id="status">슬랙 연동 중...</h2>
        <p id="message">잠시만 기다려주세요</p>
    </div>

    <script>
        (async function() {
            const code = ${JSON.stringify(code)};
            const userEmail = ${JSON.stringify(state)};
            const error = ${JSON.stringify(error)};

            if (error) {
                document.getElementById('status').textContent = '연동 실패';
                document.getElementById('message').innerHTML = '<div class="error">슬랙 인증이 취소되었거나 실패했습니다: ' + error + '</div>';

                if (window.opener) {
                    window.opener.postMessage({
                        type: 'slack-link-error',
                        error: error
                    }, '*');
                }

                setTimeout(() => window.close(), 3000);
                return;
            }

            if (!code || !userEmail) {
                document.getElementById('status').textContent = '연동 실패';
                document.getElementById('message').innerHTML = '<div class="error">인증 정보가 없습니다.</div>';
                setTimeout(() => window.close(), 3000);
                return;
            }

            try {
                const response = await fetch('/api/auth/link-slack', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code, state: ${JSON.stringify(state)} }),
                });

                const data = await response.json();

                if (response.ok) {
                    document.getElementById('status').textContent = '연동 완료!';
                    document.getElementById('message').textContent = data.teamName + ' 워크스페이스가 연동되었습니다.';

                    if (window.opener && !window.opener.closed) {
                        window.opener.postMessage({
                            type: 'slack-link-success',
                            data: data
                        }, '*');
                    } else {
                        alert('연동이 완료되었습니다! 이 창을 닫고 페이지를 새로고침해주세요.');
                    }

                    setTimeout(() => window.close(), 2000);
                } else {
                    throw new Error(data.error || '연동 실패');
                }
            } catch (err) {
                document.getElementById('status').textContent = '연동 실패';
                document.getElementById('message').innerHTML = '<div class="error">' + err.message + '</div>';

                if (window.opener) {
                    window.opener.postMessage({
                        type: 'slack-link-error',
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
