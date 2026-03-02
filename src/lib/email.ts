/**
 * 이메일 발송 유틸리티 (Resend SDK)
 */

import { Resend } from 'resend';
import { logger } from './logger';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Fi.eri <noreply@fi-eri.com>';

/**
 * 인증코드 이메일 발송
 */
export async function sendVerificationEmail(
    to: string,
    code: string,
    name: string
): Promise<boolean> {
    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: `[Fi.eri] 인증코드: ${code}`,
            html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #F59E0B; font-size: 28px; margin: 0;">Fi.eri</h1>
    <p style="color: #6B7280; margin-top: 4px;">당신의 AI 라이프 코치</p>
  </div>
  <p style="color: #1F2937; font-size: 16px;">안녕하세요, ${name}님!</p>
  <p style="color: #4B5563; font-size: 15px;">아래 인증코드를 앱에 입력해주세요.</p>
  <div style="background: #FFFBEB; border: 2px solid #FDE68A; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
    <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #D97706;">${code}</span>
  </div>
  <p style="color: #9CA3AF; font-size: 13px;">이 코드는 10분간 유효합니다.</p>
  <p style="color: #9CA3AF; font-size: 13px;">본인이 요청하지 않았다면 이 이메일을 무시해주세요.</p>
</div>`,
        });

        if (error) {
            logger.error('[Email] 인증코드 발송 실패:', error);
            return false;
        }

        logger.info(`[Email] 인증코드 발송 완료: ${to}`);
        return true;
    } catch (err) {
        logger.error('[Email] 인증코드 발송 예외:', err);
        return false;
    }
}

/**
 * 비밀번호 재설정 이메일 발송
 */
export async function sendPasswordResetEmail(
    to: string,
    resetToken: string
): Promise<boolean> {
    try {
        const resetUrl = `https://fieri.app/reset-password?token=${resetToken}`;

        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: '[Fi.eri] 비밀번호 재설정',
            html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #F59E0B; font-size: 28px; margin: 0;">Fi.eri</h1>
  </div>
  <p style="color: #1F2937; font-size: 16px;">비밀번호 재설정을 요청하셨습니다.</p>
  <p style="color: #4B5563;">아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${resetUrl}" style="background: #F59E0B; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">비밀번호 재설정</a>
  </div>
  <p style="color: #9CA3AF; font-size: 13px;">이 링크는 1시간 동안 유효합니다.</p>
  <p style="color: #9CA3AF; font-size: 13px;">본인이 요청하지 않았다면 이 이메일을 무시해주세요.</p>
</div>`,
        });

        if (error) {
            logger.error('[Email] 비밀번호 재설정 이메일 발송 실패:', error);
            return false;
        }
        return true;
    } catch (err) {
        logger.error('[Email] 비밀번호 재설정 이메일 발송 예외:', err);
        return false;
    }
}
