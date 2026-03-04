"use client";

/**
 * 비밀번호 재설정 웹 페이지
 *
 * 이메일 링크로 접속 시:
 * 1. 앱이 설치되어 있으면 fieri:// 딥링크로 앱 열기
 * 2. 앱이 없으면 웹에서 직접 비밀번호 재설정
 */

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.spinner} />
            <h2 style={styles.title}>로딩 중...</h2>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [appOpened, setAppOpened] = useState(false);

  // 앱 딥링크 시도
  useEffect(() => {
    if (!token) return;

    const deepLink = `fieri://reset-password?token=${token}`;
    const timeout = setTimeout(() => {
      // 2초 후에도 페이지에 있으면 앱이 없는 것 → 웹 폼 표시
      setAppOpened(false);
    }, 2000);

    // 앱 열기 시도
    window.location.href = deepLink;
    setAppOpened(true);

    return () => clearTimeout(timeout);
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "비밀번호 재설정에 실패했습니다.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>!</div>
          <h2 style={styles.title}>잘못된 링크</h2>
          <p style={styles.description}>
            유효하지 않은 비밀번호 재설정 링크입니다.
            <br />
            이메일에서 링크를 다시 확인해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (appOpened) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <h2 style={styles.title}>Fi.eri 앱 열기</h2>
          <p style={styles.description}>앱에서 비밀번호를 재설정합니다...</p>
          <p style={styles.hint}>
            앱이 열리지 않나요?{" "}
            <button
              onClick={() => setAppOpened(false)}
              style={styles.linkButton}
            >
              여기서 직접 변경하기
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.title}>비밀번호 변경 완료!</h2>
          <p style={styles.description}>
            새로운 비밀번호로 Fi.eri 앱에서 로그인해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>Fi.eri</h1>
        <h2 style={styles.title}>새 비밀번호 설정</h2>
        <p style={styles.description}>
          새로운 비밀번호를 입력해주세요.
          <br />
          8자 이상으로 설정해주세요.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <input
              type="password"
              placeholder="새 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              minLength={8}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              minLength={8}
              required
            />
          </div>

          {confirmPassword.length > 0 && (
            <p
              style={{
                ...styles.matchText,
                color: password === confirmPassword ? "#22C55E" : "#EF4444",
              }}
            >
              {password === confirmPassword
                ? "✓ 비밀번호가 일치합니다"
                : "✗ 비밀번호가 일치하지 않습니다"}
            </p>
          )}

          {error && <p style={styles.errorText}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "처리 중..." : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8F0",
    padding: "24px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "20px",
    padding: "40px 32px",
    maxWidth: "400px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 4px 24px rgba(217, 119, 6, 0.08)",
  },
  logo: {
    color: "#F59E0B",
    fontSize: "32px",
    fontWeight: "700",
    margin: "0 0 24px",
  },
  title: {
    color: "#1F2937",
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 8px",
  },
  description: {
    color: "#6B7280",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 28px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  inputGroup: {
    width: "100%",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "16px",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    backgroundColor: "#F9FAFB",
    color: "#1F2937",
    outline: "none",
    boxSizing: "border-box",
  },
  matchText: {
    fontSize: "13px",
    margin: "0",
    textAlign: "left",
  },
  errorText: {
    color: "#EF4444",
    fontSize: "14px",
    margin: "0",
  },
  submitButton: {
    backgroundColor: "#F59E0B",
    color: "#FFFFFF",
    fontSize: "16px",
    fontWeight: "600",
    padding: "14px",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    marginTop: "8px",
  },
  successIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "32px",
    backgroundColor: "#DCFCE7",
    color: "#22C55E",
    fontSize: "32px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  errorIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "32px",
    backgroundColor: "#FEE2E2",
    color: "#EF4444",
    fontSize: "32px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  spinner: {
    width: "48px",
    height: "48px",
    border: "4px solid #FDE68A",
    borderTopColor: "#F59E0B",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 20px",
  },
  hint: {
    fontSize: "14px",
    color: "#9CA3AF",
    marginTop: "16px",
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "#F59E0B",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "14px",
    padding: 0,
  },
};
