import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import './puppeteer'; // Puppeteer 관련 기능 import

// 환경 변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 서버 인스턴스를 저장할 변수 선언
let server: any;

// 요청 로깅 미들웨어
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// JSON 요청 본문 파싱 미들웨어
app.use(express.json());

// 라우트 등록
// app.use('/api', rootRoute);

// 서버 종료 API 엔드포인트
app.get('/server-kill', (_req: Request, res: Response) => {
  const key = _req.query.key; // 쿼리 파라미터에서 키 가져오기
  const validKey = process.env.SERVER_KILL_KEY; // 환경 변수에서 유효한 키 가져오기
  if (key !== validKey) {
    res.status(403).send('서버 종료 권한이 없습니다.'); // 권한이 없을 경우
    return;
  }

  res.send('서버를 종료합니다...');
  console.log('서버 종료 요청을 받았습니다...');

  // 1초 후에 서버 종료 (응답을 보내기 위한 지연)
  setTimeout(() => {
    console.log('server', server);
    if (server) {
      server.close(() => {
        console.log('서버가 정상적으로 종료되었습니다.');
        process.exit(0);
      });
    } else {
      console.log('서버 인스턴스를 찾을 수 없습니다.');
      process.exit(1);
    }
  }, 1000);
});

// 기본 라우트
app.get('/', (_req: Request, res: Response) => {
  res.send('서버가 실행 중입니다.');
});

// 404 라우트 핸들러
app.use((_req: Request, res: Response) => {
  console.log('404 오류 발생 - 요청한 경로를 찾을 수 없습니다.');
  res.status(404).send('요청한 경로를 찾을 수 없습니다.');
});

// 오류 처리 미들웨어
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('서버 오류:', err);
  res.status(500).send('서버 내부 오류가 발생했습니다.');
});

// 서버 시작
server = app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log('\n=== API 엔드포인트 목록 ===');
  console.log('기본 엔드포인트:');
});
