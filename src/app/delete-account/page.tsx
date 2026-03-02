"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DeleteAccountPage() {
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
                <h1 className="text-3xl font-black mb-2">계정 삭제 요청</h1>
                <p className="text-gray-400 text-sm mb-10">Account Deletion Request</p>

                <div className="prose prose-gray max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-gray-600 [&_ul]:mb-4 [&_ul]:text-gray-600 [&_li]:mb-1">

                    <h2>앱 내에서 계정 삭제하기</h2>
                    <p>
                        Fi.eri 앱에서 직접 계정을 삭제할 수 있습니다:
                    </p>
                    <ol className="list-decimal pl-6 mb-6 text-gray-600 space-y-2">
                        <li>Fi.eri 앱을 열고 로그인합니다.</li>
                        <li><strong>설정</strong> (하단 탭) → <strong>계정 관리</strong>로 이동합니다.</li>
                        <li><strong>&quot;계정 삭제&quot;</strong> 버튼을 탭합니다.</li>
                        <li>비밀번호를 입력하여 본인 확인 후 삭제가 완료됩니다.</li>
                    </ol>

                    <h2>이메일로 삭제 요청하기</h2>
                    <p>
                        앱에 접근할 수 없는 경우, 아래 이메일로 계정 삭제를 요청할 수 있습니다:
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
                        <p className="text-gray-800 font-semibold mb-1">이메일: privacy@fi-eri.com</p>
                        <p className="text-gray-500 text-sm">제목에 &quot;계정 삭제 요청&quot;을 포함하고, 가입 시 사용한 이메일 주소를 본문에 기재해주세요.</p>
                    </div>
                    <p>
                        이메일로 요청하신 경우, 본인 확인 절차를 거쳐 <strong>7일 이내</strong>에 처리됩니다.
                    </p>

                    <h2>삭제되는 데이터</h2>
                    <p>
                        계정 삭제 시 다음 데이터가 <strong>즉시 영구 삭제</strong>되며 복구할 수 없습니다:
                    </p>
                    <ul className="list-disc pl-6">
                        <li>계정 정보 (이메일, 이름, 비밀번호)</li>
                        <li>일정 및 완료 기록</li>
                        <li>AI 채팅 기록 및 메모리</li>
                        <li>학습 진도 및 커리큘럼</li>
                        <li>주간 리포트 기록</li>
                        <li>프로필 설정 (직업, 관심사, 목표 등)</li>
                        <li>연동된 외부 서비스 토큰 (Gmail, Google Calendar, Slack 등)</li>
                        <li>푸시 알림 토큰</li>
                        <li>업로드한 학습 자료 파일</li>
                        <li>구독 및 사용량 기록</li>
                    </ul>

                    <h2>유의사항</h2>
                    <ul className="list-disc pl-6">
                        <li>삭제된 데이터는 복구할 수 없습니다.</li>
                        <li>활성 구독이 있는 경우, 계정 삭제 전에 앱 스토어에서 구독을 취소해주세요.</li>
                        <li>계정 삭제는 즉시 처리되며, 삭제 후 동일 이메일로 재가입이 가능합니다.</li>
                    </ul>
                </div>
            </article>
        </div>
    );
}
