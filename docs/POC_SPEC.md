# Bus Seed Propagation PoC

## 1. 목적

실제 GPS 이동 데이터를 이용해 다음 상태 전이가 기술적으로 가능한지 검증한다.

A 정류장 접근
→ A 정류장 체류
→ 씨앗 획득
→ A 정류장 이탈
→ 이동
→ B 정류장 접근
→ B 정류장 체류
→ 도착 인정
→ A의 씨앗을 B에 전파

이 PoC는 완성된 서비스를 만드는 것이 아니라
"현실의 체류와 이동을 디지털 생태계의 상태 변화로 변환할 수 있는가"
를 검증하기 위한 기술 실험이다.


## 2. 범위

포함

- 정류장 A, B 좌표 하드코딩
- 브라우저 Geolocation API
- 현재 GPS 위치 표시
- GPS accuracy 표시
- A, B까지 거리 계산
- 정류장 진입 감지
- 정류장 이탈 감지
- 체류 시간 측정
- 이동 상태 관리
- 씨앗 획득
- 씨앗 전파
- 이벤트 로그
- localStorage 저장
- 가상 GPS 테스트 기능

제외

- 회원가입 및 로그인
- 서버
- DB
- 실제 버스 API
- 실제 노선 API
- 지도 SDK
- AI
- 날씨
- 다른 사용자와의 동기화
- 생태계 그래픽
- 백그라운드 위치 추적


## 3. 상태

IDLE
AT_A
SEED_READY
MOVING
APPROACHING_B
AT_B
PROPAGATED


## 4. 초기 판정 규칙

A 진입:
A와 거리 <= 40m

A 체류 완료:
A 반경 내에서 20초 유지

A 이탈:
A와 거리 >= 60m

B 접근:
B와 거리 <= 80m

B 도착 후보:
B와 거리 <= 40m

B 도착 인정:
B 도착 후보 상태에서 15초 유지

B 이탈:
B와 거리 >= 60m


## 5. 상태 전이

IDLE
→ A 40m 이내
→ AT_A

AT_A
→ 20초 체류
→ SEED_READY

SEED_READY
→ A에서 60m 이상 이탈
→ MOVING

MOVING
→ B 80m 이내
→ APPROACHING_B

APPROACHING_B
→ B 40m 이내에서 15초 체류
→ AT_B

AT_B
→ 씨앗 전파 처리
→ PROPAGATED


## 6. 씨앗 데이터

SeedPropagation {
  id
  originStopId
  destinationStopId
  propagatedAt
}


## 7. GPS 이벤트 기록

LocationSample {
  timestamp
  latitude
  longitude
  accuracy
  distanceToA
  distanceToB
  state
}


## 8. 화면

하나의 디버그 화면만 구현한다.

표시 항목:

- 현재 위도
- 현재 경도
- GPS accuracy
- 현재 상태
- A까지 거리
- B까지 거리
- A 체류 시간
- B 체류 시간
- 씨앗 보유 여부
- 씨앗 전파 결과
- Event Log


## 9. 성공 기준

다음 한 사이클이 사용자의 추가 입력 없이 실행될 것.

A 접근
→ 체류
→ 씨앗 획득
→ 이동
→ B 접근
→ 도착
→ 씨앗 전파

최소 5회 현장 테스트를 실시하고 각 단계 성공 여부와 실패 원인을 기록한다.