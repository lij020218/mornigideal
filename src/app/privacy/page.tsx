"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#FFFCF7] text-gray-900">
            {/* Nav */}
            <nav className="sticky top-0 z-50 bg-[#FFFCF7]/80 backdrop-blur-xl border-b border-amber-200/50">
                <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
                    <Link href="/landing" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition text-sm">
                        <ArrowLeft className="w-4 h-4" />
                        돌아가기
                    </Link>
                </div>
            </nav>

            <article className="max-w-3xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-black mb-2">개인정보처리방침</h1>
                <p className="text-gray-400 text-sm mb-10">시행일: 2026년 2월 7일 | 최종 수정: 2026년 2월 7일</p>

                <div className="prose prose-gray max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-gray-600 [&_ul]:mb-4 [&_ul]:text-gray-600 [&_li]:mb-1 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:p-3 [&_th]:bg-amber-50 [&_th]:font-semibold [&_td]:p-3 [&_td]:border-b [&_td]:border-gray-100">

                    <p>
                        Fi.eri(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요하게 여기며, 「개인정보 보호법」 및 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」을 준수합니다.
                        본 개인정보처리방침은 서비스가 어떤 정보를 수집하고, 어떻게 이용·보관·파기하는지 안내합니다.
                    </p>

                    <h2>1. 수집하는 개인정보 항목</h2>

                    <h3>가. 회원가입 시 필수 수집</h3>
                    <table>
                        <thead><tr><th>항목</th><th>수집 목적</th></tr></thead>
                        <tbody>
                            <tr><td>이메일</td><td>계정 식별, 로그인, 서비스 안내</td></tr>
                            <tr><td>이름(닉네임)</td><td>서비스 내 표시, AI 인사</td></tr>
                            <tr><td>비밀번호</td><td>계정 보안 (bcrypt 해시 저장)</td></tr>
                        </tbody>
                    </table>

                    <h3>나. 서비스 이용 중 수집</h3>
                    <table>
                        <thead><tr><th>항목</th><th>수집 목적</th></tr></thead>
                        <tbody>
                            <tr><td>직업, 관심사, 목표</td><td>AI 맞춤 추천 및 일정 설계</td></tr>
                            <tr><td>일정(스케줄) 데이터</td><td>일정 관리, 완료율 분석, 주간 리포트</td></tr>
                            <tr><td>채팅 메시지</td><td>AI 대화, 맥락 유지, 장기 기억(RAG)</td></tr>
                            <tr><td>학습 진도</td><td>AI 커리큘럼 생성 및 진행 추적</td></tr>
                            <tr><td>기상/취침 시간</td><td>최적 일정 시간대 추천</td></tr>
                            <tr><td>위치 정보(선택)</td><td>날씨 기반 일정 추천</td></tr>
                            <tr><td>기기 푸시 토큰</td><td>알림 발송</td></tr>
                        </tbody>
                    </table>

                    <h3>다. 선택적 연동 시 수집</h3>
                    <table>
                        <thead><tr><th>연동 서비스</th><th>수집 항목</th><th>수집 목적</th></tr></thead>
                        <tbody>
                            <tr><td>Google 계정</td><td>OAuth 토큰, 프로필 정보</td><td>간편 로그인</td></tr>
                            <tr><td>Google Calendar</td><td>캘린더 이벤트, OAuth 토큰</td><td>일정 동기화</td></tr>
                            <tr><td>Gmail</td><td>이메일 요약(읽기전용), OAuth 토큰</td><td>일정·업무 맥락 파악</td></tr>
                            <tr><td>Slack</td><td>메시지 요약, 채널 목록, OAuth 토큰</td><td>업무 맥락 파악</td></tr>
                        </tbody>
                    </table>

                    <h2>2. 개인정보의 이용 목적</h2>
                    <ul>
                        <li>AI 기반 일정 관리 및 개인 성장 서비스 제공</li>
                        <li>맞춤형 학습 커리큘럼 및 트렌드 브리핑 생성</li>
                        <li>주간 성장 리포트 및 분석 제공</li>
                        <li>프로액티브 알림(일정 준비, 목표 리마인더 등) 발송</li>
                        <li>서비스 개선 및 AI 모델 품질 향상</li>
                        <li>구독 플랜 관리 및 이용량 추적</li>
                    </ul>

                    <h2>3. 개인정보의 제3자 제공 및 국외이전</h2>
                    <p>
                        서비스는 AI 기능 제공을 위해 아래 해외 사업자에게 이용자의 정보를 전송합니다.
                        이는 서비스의 핵심 기능 제공에 필수적이며, 가입 시 별도 동의를 받습니다.
                    </p>
                    <table>
                        <thead><tr><th>수신자</th><th>국가</th><th>전송 항목</th><th>목적</th></tr></thead>
                        <tbody>
                            <tr><td>OpenAI</td><td>미국</td><td>채팅 메시지, 프로필 맥락, 일정 정보</td><td>AI 대화 생성, 임베딩 생성</td></tr>
                            <tr><td>Anthropic</td><td>미국</td><td>채팅 메시지 (사용자 API 키 이용 시)</td><td>AI 대화 생성</td></tr>
                            <tr><td>Google (Gemini)</td><td>미국</td><td>채팅 메시지 (사용자 API 키 이용 시)</td><td>AI 대화 생성</td></tr>
                            <tr><td>Tavily</td><td>미국</td><td>검색 쿼리</td><td>웹 검색 결과 제공</td></tr>
                            <tr><td>Supabase</td><td>미국</td><td>모든 서비스 데이터</td><td>데이터베이스 호스팅</td></tr>
                            <tr><td>Vercel</td><td>미국/글로벌</td><td>서비스 요청 데이터</td><td>앱 호스팅 및 서버리스 실행</td></tr>
                            <tr><td>Expo</td><td>미국</td><td>푸시 토큰</td><td>모바일 알림 발송</td></tr>
                        </tbody>
                    </table>

                    <h2>4. 개인정보의 보유 및 이용 기간</h2>
                    <table>
                        <thead><tr><th>데이터 유형</th><th>보유 기간</th></tr></thead>
                        <tbody>
                            <tr><td>계정 정보(이메일, 이름)</td><td>탈퇴 시까지</td></tr>
                            <tr><td>채팅 기록</td><td>Free: 30일 / Pro·Max: 탈퇴 시까지</td></tr>
                            <tr><td>AI 기억(임베딩)</td><td>Free: 30일 / Pro: 무제한 / Max: 무제한</td></tr>
                            <tr><td>일정·이벤트 로그</td><td>7일 (자동 정리)</td></tr>
                            <tr><td>날씨 캐시</td><td>1시간</td></tr>
                            <tr><td>OAuth 토큰</td><td>연동 해제 시까지</td></tr>
                            <tr><td>푸시 토큰</td><td>로그아웃 또는 비활성화 시까지</td></tr>
                        </tbody>
                    </table>
                    <p>보유 기간 경과 또는 탈퇴 시 해당 정보는 지체 없이 파기합니다.</p>

                    <h2>5. 자동화된 의사결정</h2>
                    <p>
                        서비스는 AI를 활용하여 다음과 같은 자동화된 의사결정을 수행합니다:
                    </p>
                    <ul>
                        <li>일정 충돌 감지 및 대안 제안</li>
                        <li>맞춤형 학습 커리큘럼 자동 생성</li>
                        <li>프로액티브 알림 시점 및 내용 결정</li>
                        <li>주간 리포트 분석 및 성장 패턴 추출</li>
                    </ul>
                    <p>
                        이용자는 설정에서 자동 실행 모드를 끄거나, 개별 추천을 거부할 수 있습니다.
                        자동화된 의사결정에 대한 설명을 요구하거나 이의를 제기할 권리가 있습니다.
                    </p>

                    <h2>6. 이용자의 권리</h2>
                    <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다:</p>
                    <ul>
                        <li><strong>열람 요구권</strong> — 수집된 개인정보의 내용을 확인할 수 있습니다.</li>
                        <li><strong>정정·삭제 요구권</strong> — 잘못된 정보를 수정하거나 삭제를 요청할 수 있습니다.</li>
                        <li><strong>처리정지 요구권</strong> — 개인정보 처리의 정지를 요구할 수 있습니다.</li>
                        <li><strong>동의 철회권</strong> — 제3자 제공 동의 등을 언제든 철회할 수 있습니다.</li>
                        <li><strong>탈퇴권</strong> — 설정 &gt; 계정에서 계정을 삭제할 수 있으며, 모든 데이터가 즉시 파기됩니다.</li>
                    </ul>
                    <p>위 권리 행사는 앱 내 설정 또는 아래 연락처를 통해 가능합니다.</p>

                    <h2>7. 개인정보의 안전성 확보 조치</h2>
                    <ul>
                        <li>비밀번호는 bcrypt(12 rounds) 해시로 저장하여 원문을 보관하지 않습니다.</li>
                        <li>모든 통신은 HTTPS(TLS)로 암호화됩니다.</li>
                        <li>API 접근에 대한 Rate Limiting(분당 요청 제한)을 적용합니다.</li>
                        <li>CORS 화이트리스트로 허가된 도메인만 API에 접근할 수 있습니다.</li>
                        <li>사용자 제공 API 키는 AES-256으로 암호화하여 저장합니다.</li>
                        <li>데이터베이스 접근은 Row Level Security(RLS)로 보호됩니다.</li>
                    </ul>

                    <h2>8. 만 14세 미만 아동의 개인정보</h2>
                    <p>
                        서비스는 만 14세 미만 아동의 가입을 허용하지 않습니다.
                        만 14세 미만임이 확인될 경우 해당 계정과 데이터를 즉시 삭제합니다.
                    </p>

                    <h2>9. 개인정보 보호책임자</h2>
                    <table>
                        <thead><tr><th>구분</th><th>내용</th></tr></thead>
                        <tbody>
                            <tr><td>담당자</td><td>Fi.eri 개인정보 보호 담당</td></tr>
                            <tr><td>이메일</td><td>privacy@fieri.app</td></tr>
                        </tbody>
                    </table>
                    <p>
                        개인정보 침해에 대한 신고나 상담은 아래 기관에도 문의하실 수 있습니다:
                    </p>
                    <ul>
                        <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
                        <li>개인정보 분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
                    </ul>

                    <h2>10. 개인정보처리방침의 변경</h2>
                    <p>
                        본 방침이 변경될 경우 시행일 7일 전에 앱 내 공지 또는 이메일로 안내합니다.
                        중요 변경사항(수집 항목 추가, 제3자 제공 변경 등)은 30일 전에 안내하며 별도 동의를 받습니다.
                    </p>
                </div>
            </article>
        </div>
    );
}
