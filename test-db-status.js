/**
 * 데이터베이스 상태 테스트 스크립트
 *
 * 사용법:
 * 1. 브라우저 콘솔에서 실행
 * 2. 또는 curl로 API 호출
 */

console.log('=== 데이터베이스 상태 확인 ===\n');
console.log('다음 URL을 브라우저에서 방문하거나 fetch로 호출하세요:');
console.log('http://localhost:3001/api/debug/check-db\n');

console.log('또는 브라우저 콘솔에서 다음 코드를 실행:');
console.log(`
fetch('/api/debug/check-db')
  .then(res => res.json())
  .then(data => {
    console.log('=== 데이터베이스 상태 ===');
    console.log('사용자:', data.userEmail);
    console.log('\\n[테이블 상태]');
    Object.entries(data.tables).forEach(([table, info]) => {
      console.log(\`\\n📊 \${table}:\`);
      if (info.exists) {
        console.log('  ✅ 테이블 존재');
        if (info.hasData !== undefined) {
          console.log(\`  데이터: \${info.hasData ? '있음' : '없음'}\`);
        }
        if (info.totalCount !== undefined) {
          console.log(\`  총 개수: \${info.totalCount}\`);
        }
      } else {
        console.log('  ❌ 테이블 없음 또는 접근 불가');
        console.log(\`  오류: \${info.error}\`);
      }
    });

    console.log('\\n[오늘 일정]');
    console.log('날짜:', data.todaySchedules?.date);
    console.log('개수:', data.todaySchedules?.count);
    if (data.todaySchedules?.schedules) {
      data.todaySchedules.schedules.forEach((s, i) => {
        console.log(\`  \${i+1}. \${s.text} (\${s.startTime} - \${s.endTime})\`);
      });
    }
  })
  .catch(err => console.error('에러:', err));
`);
