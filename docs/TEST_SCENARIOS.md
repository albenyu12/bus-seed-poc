# Test Scenarios

## Scenario 1. 정상 플로우

Given
사용자는 IDLE 상태이다.

When
A 정류장 40m 안으로 진입한다.

Then
상태는 AT_A가 된다.


## Scenario 2. A 체류

Given
상태가 AT_A다.

When
A 반경 안에서 20초가 지난다.

Then
상태는 SEED_READY가 된다.
씨앗을 하나 보유한다.


## Scenario 3. GPS 흔들림

Given
사용자가 A에 체류 중이다.

When
GPS 위치가 45m, 50m, 55m 사이에서 흔들린다.

Then
AT_A 상태를 유지해야 한다.


## Scenario 4. A 이탈

Given
SEED_READY 상태다.

When
A와의 거리가 60m 이상이 된다.

Then
MOVING 상태가 된다.


## Scenario 5. B를 스쳐 지나감

Given
MOVING 상태다.

When
B 반경 40m 안에 들어오지만
15초 전에 다시 벗어난다.

Then
AT_B로 판정하지 않는다.
씨앗을 전파하지 않는다.


## Scenario 6. 정상 전파

Given
APPROACHING_B 상태다.

When
B 40m 안에서 15초간 체류한다.

Then
AT_B가 되고
씨앗 전파 이벤트가 한 번 발생하며
PROPAGATED 상태가 된다.


## Scenario 7. 중복 전파 방지

Given
이미 PROPAGATED 상태다.

When
GPS 업데이트가 추가로 발생한다.

Then
같은 이동에 대해 씨앗을 다시 생성하지 않는다.