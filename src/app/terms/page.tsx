"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
                <h1 className="text-3xl font-black mb-2">서비스 이용약관</h1>
                <p className="text-gray-400 text-sm mb-10">시행일: 2026년 2월 7일 | 최종 수정: 2026년 2월 7일</p>

                <div className="prose prose-gray max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-gray-600 [&_ul]:mb-4 [&_ul]:text-gray-600 [&_li]:mb-1 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:p-3 [&_th]:bg-amber-50 [&_th]:font-semibold [&_td]:p-3 [&_td]:border-b [&_td]:border-gray-100">

                    <h2>제1조 (목적)</h2>
                    <p>
                        본 약관은 Fi.eri(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리·의무·책임사항을 규정함을 목적으로 합니다.
                    </p>

                    <h2>제2조 (용어의 정의)</h2>
                    <ul>
                        <li><strong>&quot;서비스&quot;</strong>란 Fi.eri가 제공하는 AI 기반 개인 성장 OS를 말합니다.</li>
                        <li><strong>&quot;이용자&quot;</strong>란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
                        <li><strong>&quot;AI 비서&quot;</strong>란 서비스 내에서 일정 관리, 학습 추천, 트렌드 브리핑 등을 수행하는 인공지능 시스템을 말합니다.</li>
                        <li><strong>&quot;구독&quot;</strong>이란 월 단위로 유료 플랜(Pro, Max)을 결제하여 이용하는 것을 말합니다.</li>
                    </ul>

                    <h2>제3조 (약관의 효력 및 변경)</h2>
                    <ul>
                        <li>본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력을 발생합니다.</li>
                        <li>약관 변경 시 적용일 7일 전부터 공지합니다. 이용자에게 불리한 변경은 30일 전에 공지하며 별도 동의를 받습니다.</li>
                        <li>변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
                    </ul>

                    <h2>제4조 (회원가입 및 계정)</h2>
                    <ul>
                        <li>이용자는 이메일 또는 Google 계정으로 가입할 수 있습니다.</li>
                        <li>만 14세 미만은 가입할 수 없습니다.</li>
                        <li>가입 시 정확한 정보를 제공해야 하며, 허위 정보 제공 시 서비스 이용이 제한될 수 있습니다.</li>
                        <li>계정 정보 관리 책임은 이용자에게 있으며, 제3자에게 계정을 양도하거나 공유할 수 없습니다.</li>
                    </ul>

                    <h2>제5조 (서비스의 내용)</h2>
                    <p>서비스는 다음 기능을 제공합니다:</p>
                    <ul>
                        <li>AI 채팅 비서 (일정 추가·수정·삭제, 목표 관리, 학습 추천)</li>
                        <li>스마트 일정 관리 (반복 일정, 충돌 감지, 완료율 분석)</li>
                        <li>AI 학습 커리큘럼 및 슬라이드 생성</li>
                        <li>프로액티브 알림 (일정 준비, 목표 리마인더, 저녁 체크인)</li>
                        <li>트렌드 브리핑 (관심 분야 뉴스 요약)</li>
                        <li>주간 성장 리포트 및 인스타 스토리 공유</li>
                    </ul>

                    <h2>제6조 (서비스 플랜 및 결제)</h2>

                    <h3>가. 플랜 구성</h3>
                    <table>
                        <thead><tr><th>플랜</th><th>가격</th><th>주요 기능</th></tr></thead>
                        <tbody>
                            <tr><td>Free</td><td>무료</td><td>일일 AI 30회, AI 일정 관리, 컨텍스트 융합, 선제적 알림</td></tr>
                            <tr><td>Pro</td><td>₩6,900/월</td><td>일일 AI 100회, ReAct 에이전트, 리스크 알림, 스마트 브리핑</td></tr>
                            <tr><td>Max</td><td>₩14,900/월</td><td>무제한 AI, 장기 기억(RAG), 자동 실행</td></tr>
                        </tbody>
                    </table>

                    <h3>나. 결제 및 갱신</h3>
                    <ul>
                        <li>유료 플랜은 Apple App Store 또는 Google Play Store의 인앱 결제를 통해 구독합니다.</li>
                        <li>구독은 월 단위로 자동 갱신됩니다.</li>
                        <li>결제, 환불, 자동 갱신 관리는 각 스토어의 정책을 따릅니다.</li>
                        <li>구독 해지는 각 스토어의 구독 관리에서 가능하며, 해지 후 현재 결제 기간 종료까지 서비스를 이용할 수 있습니다.</li>
                    </ul>

                    <h3>다. 가격 변경</h3>
                    <p>
                        가격 변경 시 최소 30일 전에 공지하며, 기존 구독자에게는 다음 갱신 주기부터 적용됩니다.
                    </p>

                    <h2>제7조 (AI 서비스의 특성 및 면책)</h2>
                    <ul>
                        <li>AI 비서가 생성하는 모든 콘텐츠(일정 추천, 학습 자료, 트렌드 분석 등)는 참고용이며, 전문적인 조언을 대체하지 않습니다.</li>
                        <li>AI 응답의 정확성, 완전성, 적시성을 보장하지 않습니다.</li>
                        <li>AI는 의료, 법률, 재무 등 전문 영역에 대한 조언을 제공하지 않으며, 관련 질문에 응답하지 않습니다.</li>
                        <li>이용자는 AI 추천을 수락하거나 거부할 자유가 있으며, AI 추천에 따른 결과에 대한 최종 책임은 이용자에게 있습니다.</li>
                    </ul>

                    <h2>제8조 (이용자의 의무)</h2>
                    <ul>
                        <li>타인의 개인정보를 도용하거나 서비스를 부정 이용하지 않아야 합니다.</li>
                        <li>서비스를 이용하여 법령 또는 공서양속에 반하는 행위를 하지 않아야 합니다.</li>
                        <li>서비스의 안정적 운영을 방해하는 행위(과도한 API 호출, 자동화 스크립트 등)를 하지 않아야 합니다.</li>
                        <li>서비스를 통해 수집한 정보를 서비스 목적 외로 활용하거나 제3자에게 제공하지 않아야 합니다.</li>
                    </ul>

                    <h2>제9조 (서비스의 중단 및 변경)</h2>
                    <ul>
                        <li>천재지변, 시스템 장애, 정기 점검 등 불가피한 사유로 서비스가 일시 중단될 수 있습니다.</li>
                        <li>서비스 내용, 기능, UI는 개선을 위해 변경될 수 있으며, 중요 변경 시 사전 공지합니다.</li>
                        <li>무료 서비스(Free)의 경우 서비스 변경·중단에 대해 별도 보상하지 않습니다.</li>
                    </ul>

                    <h2>제10조 (계정 탈퇴 및 데이터 삭제)</h2>
                    <ul>
                        <li>이용자는 언제든지 설정 &gt; 계정에서 탈퇴할 수 있습니다.</li>
                        <li>탈퇴 시 모든 개인정보와 서비스 데이터(채팅 기록, 일정, 학습 기록, AI 기억 등)는 즉시 삭제되며 복구할 수 없습니다.</li>
                        <li>진행 중인 유료 구독이 있는 경우, 각 스토어에서 먼저 구독을 해지한 후 탈퇴하시기 바랍니다.</li>
                    </ul>

                    <h2>제11조 (지적재산권)</h2>
                    <ul>
                        <li>서비스의 디자인, 코드, 브랜드(Fi.eri)에 대한 지적재산권은 서비스 제공자에게 있습니다.</li>
                        <li>이용자가 입력한 콘텐츠(채팅 메시지, 일정 등)의 저작권은 이용자에게 있습니다.</li>
                        <li>AI가 생성한 콘텐츠(학습 슬라이드, 트렌드 요약, 일정 추천 등)는 이용자가 개인 목적으로 자유롭게 사용할 수 있습니다.</li>
                    </ul>

                    <h2>제12조 (손해배상 및 면책)</h2>
                    <ul>
                        <li>서비스는 무료(Free) 또는 유료(Pro/Max) 형태로 제공되며, 서비스 이용으로 발생한 간접적·부수적 손해에 대해 책임지지 않습니다.</li>
                        <li>유료 서비스의 경우 귀책사유에 의한 서비스 장애 시 이용 기간 연장 또는 환불로 보상합니다.</li>
                        <li>이용자의 귀책사유(비밀번호 유출, 부정 이용 등)로 인한 손해는 서비스 제공자가 책임지지 않습니다.</li>
                    </ul>

                    <h2>제13조 (분쟁 해결)</h2>
                    <ul>
                        <li>서비스 이용과 관련한 분쟁은 대한민국 법률을 적용합니다.</li>
                        <li>분쟁 발생 시 상호 협의로 해결하며, 합의가 이루어지지 않을 경우 관할 법원에 소를 제기할 수 있습니다.</li>
                    </ul>

                    <h2>제14조 (연락처)</h2>
                    <table>
                        <thead><tr><th>구분</th><th>내용</th></tr></thead>
                        <tbody>
                            <tr><td>서비스명</td><td>Fi.eri (AI 기반 개인 성장 OS)</td></tr>
                            <tr><td>이메일</td><td>support@fieri.app</td></tr>
                        </tbody>
                    </table>
                </div>
            </article>
        </div>
    );
}
