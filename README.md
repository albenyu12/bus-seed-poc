# Bus Seed Propagation PoC

GPS로 다음 흐름을 검증하는 기술 PoC입니다.

```text
출발 정류장 체류 → 씨앗 획득 → 이동 → 도착 정류장 체류 → 씨앗 전파
```

## 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:5173](http://localhost:5173)에 접속합니다.

## Fake GPS 테스트

1. `Fake GPS`를 선택합니다.
2. 정류장 세트와 이동 방향을 선택합니다.
3. 정상 시나리오를 실행합니다.
4. 최종 상태가 `PROPAGATED`인지 확인합니다.

지원 경로:

- A → B
- B → A
- C → D
- D → C

## Browser GPS 테스트

1. HTTPS 또는 localhost에서 접속합니다.
2. 위치 권한을 허용합니다.
3. 정류장 세트와 이동 방향을 선택합니다.
4. 실제 위치에서 출발 정류장과 도착 정류장에 체류합니다.
5. `GPS 정지 및 저장`을 누릅니다.
6. 필요하면 `JSON 내보내기`로 결과를 저장합니다.

## 성공 기준

다음 이벤트가 순서대로 발생하면 성공입니다.

```text
출발 정류장 진입
→ 씨앗 획득
→ 출발 정류장 이탈
→ 도착 정류장 접근
→ 도착 인정
→ 씨앗 전파
```

최종 상태: `PROPAGATED`

## 검증 명령

```bash
npm run test
npm run build
npm run lint
```
