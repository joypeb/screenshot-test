/**
 * Smart Screenshot - 스크린샷 모드 및 요소 감지 기능
 *
 * 이 모듈은 웹 페이지에서 다양한 요소(사각형, 원, 타원, 곡선 등)를 감지하고
 * 그라데이션 테두리로 강조하는 기능을 제공합니다.
 *
 * @author Smart Screenshot Team
 * @version 1.0.0
 */

// 전역 변수: 스크린샷 모드 상태 및 필요한 요소들
let screenshotModeActive = false;
let overlayElement = null;       // 요소 강조를 위한 오버레이
let backdropElement = null;      // 배경 오버레이 (선택 영역 외 어둡게 표시)
let currentTarget = null;        // 현재 감지된 요소
let debounceTimer = null;        // 성능 최적화를 위한 디바운스 타이머

// 그라데이션 색상 옵션 (랜덤하게 선택됨)
const GRADIENT_COLORS = [
  ['#4589ff', '#6c5df6', '#a164f7'], // 블루-퍼플
  ['#00c6ff', '#0072ff'],            // 라이트 블루-블루
  ['#fc466b', '#3f5efb'],            // 핑크-블루
  ['#43cea2', '#185a9d'],            // 그린-블루
  ['#f09819', '#edde5d']             // 오렌지-옐로우
];

/**
 * 스크린샷 모드 초기화 및 시작
 * - 오버레이 요소 생성 및 이벤트 리스너 등록
 */
function startScreenshotMode() {
  if (screenshotModeActive) return;
  screenshotModeActive = true;

  // 배경 오버레이 생성 (전체 화면을 약간 어둡게)
  createBackdropOverlay();

  // 요소 하이라이트 오버레이 생성
  createElementOverlay();

  // 이벤트 리스너 등록
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('click', onElementClick, true);

  // 선택 커서로 변경하여 선택 모드임을 시각적으로 표시
  document.body.style.cursor = 'crosshair';

  console.log('스크린샷 모드가 시작되었습니다. ESC를 누르면 종료됩니다.');
}

/**
 * 배경 오버레이 생성 함수
 * - 선택 영역 외 모든 영역을 반투명하게 처리
 */
function createBackdropOverlay() {
  backdropElement = document.createElement('div');
  backdropElement.style.position = 'fixed';
  backdropElement.style.top = '0';
  backdropElement.style.left = '0';
  backdropElement.style.width = '100%';
  backdropElement.style.height = '100%';
  backdropElement.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  backdropElement.style.zIndex = '9998';
  backdropElement.style.pointerEvents = 'none'; // 이벤트가 하위 요소로 전달되도록
  document.body.appendChild(backdropElement);
}

/**
 * 요소 하이라이트 오버레이 생성 함수
 * - 감지된 요소 주변에 표시될 그라데이션 테두리 오버레이
 */
function createElementOverlay() {
  // 메인 오버레이 컨테이너
  overlayElement = document.createElement('div');
  overlayElement.style.position = 'absolute';
  overlayElement.style.pointerEvents = 'none';
  overlayElement.style.boxSizing = 'border-box';
  overlayElement.style.zIndex = '9999';
  overlayElement.style.transition = 'all 0.15s ease-out';
  overlayElement.style.backgroundColor = 'transparent';

  // CSS 규칙 추가 - 그라데이션 점선 테두리 효과를 위한 스타일
  if (!document.querySelector('#screenshot-style')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'screenshot-style';
    styleSheet.textContent = `
      @keyframes dash {
        to {
          stroke-dashoffset: -30;
        }
      }
      
      /* SVG 스타일 */
      .screenshot-border {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
      }
      
      .screenshot-border-path {
        fill: none;
        stroke-width: 2px;
        stroke-dasharray: 6 4;
        animation: dash 0.5s linear infinite;
      }
    `;
    document.head.appendChild(styleSheet);
  }

  // 요소를 DOM에 추가
  document.body.appendChild(overlayElement);
}

/**
 * 오버레이 테두리에 SVG 그라데이션 점선 적용 함수
 * @param {Object} rect - 요소의 위치와 크기 정보
 * @param {string} borderRadius - 요소의 border-radius 값
 */
function updateOverlayBorderStyle(rect, borderRadiusValue) {
  // 기존 SVG 제거
  const existingSvg = overlayElement.querySelector('.screenshot-border');
  if (existingSvg) {
    existingSvg.remove();
  }

  // 랜덤 그라데이션 색상 선택
  const colors = GRADIENT_COLORS[Math.floor(Math.random() * GRADIENT_COLORS.length)];

  // SVG 요소 생성
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "screenshot-border");

  // SVG 그라데이션 정의
  const gradientId = "screenshot-gradient-" + Math.floor(Math.random() * 1000000);
  const gradientDef = `
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors[0]}"/>
        ${colors.length > 2 ? `<stop offset="50%" stop-color="${colors[1]}"/>` : ''}
        <stop offset="100%" stop-color="${colors[colors.length-1]}"/>
      </linearGradient>
    </defs>
  `;
  svg.innerHTML = gradientDef;

  // 경로 생성
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "screenshot-border-path");
  path.setAttribute("stroke", `url(#${gradientId})`);

  // 요소 형태에 맞는 경로 설정
  let pathData;

  // 경로 데이터 생성: borderRadius 값에 따라 다른 경로 사용
  if (borderRadiusValue === '50%' || borderRadiusValue === '9999px') {
    // 원형 경로
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY);
    pathData = `M ${centerX - radius},${centerY} a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`;
  } else if (borderRadiusValue) {
    // border-radius가 있는 사각형
    const radiusValues = parseBorderRadius(borderRadiusValue, rect.width, rect.height);
    pathData = createRoundedRectPath(0, 0, rect.width, rect.height, radiusValues);
  } else {
    // 일반 사각형
    pathData = `M 0,0 H ${rect.width} V ${rect.height} H 0 Z`;
  }

  path.setAttribute("d", pathData);
  svg.appendChild(path);
  overlayElement.appendChild(svg);
}

/**
 * Border-radius 값을 파싱하여 각 모서리의 반경 추출
 * @param {string} borderRadiusValue - CSS border-radius 값
 * @param {number} width - 요소 너비
 * @param {number} height - 요소 높이
 * @returns {Object} 각 모서리의 x, y 반경 값
 */
function parseBorderRadius(borderRadiusValue, width, height) {
  // '50%'와 같은 백분율 형식 처리
  if (borderRadiusValue.includes('%')) {
    const percentage = parseInt(borderRadiusValue) / 100;
    const radiusX = width * percentage;
    const radiusY = height * percentage;
    return {
      topLeft: {x: radiusX, y: radiusY},
      topRight: {x: radiusX, y: radiusY},
      bottomRight: {x: radiusX, y: radiusY},
      bottomLeft: {x: radiusX, y: radiusY}
    };
  }

  // 여러 값이 있는 경우 (예: '10px 20px 30px 40px')
  const values = borderRadiusValue.split(' ').map(v => parseInt(v) || 0);

  if (values.length === 1) {
    // 하나의 값만 지정된 경우
    return {
      topLeft: {x: values[0], y: values[0]},
      topRight: {x: values[0], y: values[0]},
      bottomRight: {x: values[0], y: values[0]},
      bottomLeft: {x: values[0], y: values[0]}
    };
  } else if (values.length === 4) {
    // 네 모서리 값이 모두 지정된 경우
    return {
      topLeft: {x: values[0], y: values[0]},
      topRight: {x: values[1], y: values[1]},
      bottomRight: {x: values[2], y: values[2]},
      bottomLeft: {x: values[3], y: values[3]}
    };
  } else {
    // 기본값 사용
    return {
      topLeft: {x: 0, y: 0},
      topRight: {x: 0, y: 0},
      bottomRight: {x: 0, y: 0},
      bottomLeft: {x: 0, y: 0}
    };
  }
}

/**
 * 둥근 모서리가 있는 사각형 SVG 경로 생성
 * @param {number} x - 좌측 상단 X 좌표
 * @param {number} y - 좌측 상단 Y 좌표
 * @param {number} width - 너비
 * @param {number} height - 높이
 * @param {Object} radius - 각 모서리 반경 값
 * @returns {string} SVG 경로 데이터
 */
function createRoundedRectPath(x, y, width, height, radius) {
  return `
    M ${x + radius.topLeft.x},${y}
    H ${x + width - radius.topRight.x}
    Q ${x + width},${y} ${x + width},${y + radius.topRight.y}
    V ${y + height - radius.bottomRight.y}
    Q ${x + width},${y + height} ${x + width - radius.bottomRight.x},${y + height}
    H ${x + radius.bottomLeft.x}
    Q ${x},${y + height} ${x},${y + height - radius.bottomLeft.y}
    V ${y + radius.topLeft.y}
    Q ${x},${y} ${x + radius.topLeft.x},${y}
    Z
  `;
}

/**
 * 스크린샷 모드 종료 함수
 * - 이벤트 리스너 제거 및 오버레이 요소 정리
 */
function exitScreenshotMode() {
  if (!screenshotModeActive) return;
  screenshotModeActive = false;

  // 이벤트 리스너 해제
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('click', onElementClick, true);

  // 오버레이 요소 정리
  if (overlayElement && overlayElement.parentNode) {
    overlayElement.parentNode.removeChild(overlayElement);
    overlayElement = null;
  }

  // 배경 오버레이 정리
  if (backdropElement && backdropElement.parentNode) {
    backdropElement.parentNode.removeChild(backdropElement);
    backdropElement = null;
  }

  // 커서 원래대로 복구
  document.body.style.cursor = 'default';

  currentTarget = null;
  console.log('스크린샷 모드가 종료되었습니다.');
}

/**
 * 마우스 이동 시 요소 감지 핸들러
 * - 성능 최적화를 위해 디바운스 적용
 * @param {MouseEvent} event - 마우스 이벤트 객체
 */
function onMouseMove(event) {
  // 성능 최적화를 위한 디바운싱
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    // 마우스 커서 아래의 요소 감지
    const target = document.elementFromPoint(event.clientX, event.clientY);

    // 오버레이나 자기 자신 요소의 경우 무시
    if (!target || target === overlayElement || target === backdropElement) return;

    // 현재 감지된 요소가 이전과 다르면 오버레이 업데이트
    if (target !== currentTarget) {
      currentTarget = target;
      updateOverlayForElement(target);
    }
  }, 10); // 10ms 디바운싱 (부드러운 움직임 유지하면서 성능 최적화)
}

/**
 * 캡처 선택 요소의 클릭 이벤트 처리
 * @param {MouseEvent} event - 클릭 이벤트 객체
 */
function onElementClick(event) {
  // 기본 클릭 동작 방지
  event.preventDefault();
  event.stopPropagation();

  if (!currentTarget) return;

  // 선택된 요소 캡처
  console.log('선택된 요소를 캡처합니다:', currentTarget);
  captureSelectedElement(currentTarget);

  // 스크린샷 모드 종료
  exitScreenshotMode();
}

/**
 * 키보드 이벤트 핸들러
 * - ESC 키 입력 시 스크린샷 모드 종료
 * @param {KeyboardEvent} event - 키보드 이벤트 객체
 */
function onKeyDown(event) {
  if (event.key === 'Escape') {
    exitScreenshotMode();
  }
}

/**
 * 선택된 요소의 형태를 감지하고 오버레이 업데이트
 * - 요소의 border-radius에 따라 형태(사각형, 원, 타원 등) 감지
 * @param {HTMLElement} element - 감지된 HTML 요소
 */
function updateOverlayForElement(element) {
  // 요소의 위치 및 크기 정보 획득
  const rect = element.getBoundingClientRect();

  // 스타일 정보 획득
  const computedStyle = window.getComputedStyle(element);

  // 오버레이 위치 및 크기 설정
  overlayElement.style.top = `${rect.top + window.scrollY}px`;
  overlayElement.style.left = `${rect.left + window.scrollX}px`;
  overlayElement.style.width = `${rect.width}px`;
  overlayElement.style.height = `${rect.height}px`;

  // 형태 감지 및 적용 (border-radius 값에 따라 다른 형태 판단)
  detectAndApplyElementShape(computedStyle, rect);

  // 배경 오버레이에서 현재 요소 영역 "구멍" 만들기 (요소만 밝게 보이도록)
  createHoleInBackdrop(rect);
}

/**
 * 요소의 형태 감지 및 오버레이 스타일 적용
 * @param {CSSStyleDeclaration} computedStyle - 요소의 계산된 스타일
 * @param {DOMRect} rect - 요소의 경계 사각형 정보
 */
function detectAndApplyElementShape(computedStyle, rect) {
  // border-radius 값을 분석하여 형태 감지
  const borderRadius = computedStyle.borderRadius;
  const borderRadiusValues = borderRadius.split(' ').map(v =>
    parseInt(v) || 0
  );

  // 최대 border-radius 값
  const maxRadius = Math.max(...borderRadiusValues);

  // 가로/세로 비율 및 크기 비교로 원형/타원형 감지
  const isSquareish = Math.abs(rect.width - rect.height) < 10; // 정사각형에 가까운지
  const minDimension = Math.min(rect.width, rect.height);

  // 원형 요소 감지 (정사각형에 가깝고 border-radius가 크거나, 명시적 원 요소)
  if ((isSquareish && maxRadius >= minDimension / 2) ||
      element.tagName.toLowerCase() === 'circle') {
    overlayElement.style.borderRadius = '50%';
  }
  // 타원형 요소 감지
  else if (maxRadius >= minDimension / 3 ||
           element.tagName.toLowerCase() === 'ellipse') {
    overlayElement.style.borderRadius =
      `${Math.min(maxRadius, rect.width / 2)}px / ${Math.min(maxRadius, rect.height / 2)}px`;
  }
  // SVG 경로나 다각형 요소 (복잡한 형태)
  else if (element.tagName.toLowerCase() === 'path' ||
           element.tagName.toLowerCase() === 'polygon') {
    // SVG 요소는 복잡한 형태이므로 단순 사각 오버레이로 표시
    overlayElement.style.borderRadius = '0';
    // 향후: SVG 패스를 따라가는 복잡한 오버레이 구현 가능
  }
  // 일반 요소 (컴퓨팅된 border-radius 사용)
  else {
    overlayElement.style.borderRadius = borderRadius;
  }
}

/**
 * 배경 오버레이에 현재 선택된 요소 영역만큼 "구멍" 만들기
 * @param {DOMRect} rect - 요소의 경계 사각형 정보
 */
function createHoleInBackdrop(rect) {
  // 클리핑 패스를 이용하여 배경 오버레이에 구멍 뚫기
  // 전체 화면 영역에서 선택된 요소 영역을 뺌
  const clipPath = `
    polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%,
      0% ${rect.top}px, ${rect.left}px ${rect.top}px, 
      ${rect.left}px ${rect.bottom}px, ${rect.right}px ${rect.bottom}px,
      ${rect.right}px ${rect.top}px, 0% ${rect.top}px
    )
  `;

  backdropElement.style.clipPath = clipPath;
}

/**
 * 선택된 요소 캡처 함수 (실제 캡처 기능은 다음 단계에서 구현)
 * - 지금은 요소 정보만 기록
 * @param {HTMLElement} element - 캡처할 요소
 */
function captureSelectedElement(element) {
  // 현재는 콘솔에 요소 정보만 출력
  // 다음 개발 단계에서 실제 캡처 기능 구현 예정
  console.log('캡처 준비:', {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    rect: element.getBoundingClientRect()
  });

  // 메시지를 통해 popup.js에 캡처 요청 전달
  // 실제 구현은 2.3 단계에서 진행
  chrome.runtime.sendMessage({
    action: 'captureElement',
    elementInfo: {
      rect: {
        top: element.getBoundingClientRect().top + window.scrollY,
        left: element.getBoundingClientRect().left + window.scrollX,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height
      }
    }
  });
}

/**
 * 확장 프로그램의 메시지 리스너 설정
 * - popup.js에서 스크린샷 시작 메시지 수신 처리
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // 스크립트 로드 확인 메시지 처리
  if (request.action === 'checkScriptLoaded') {
    sendResponse({loaded: true});
    return true;
  }

  // 스크린샷 시작 메시지 처리
  if (request.action === 'startScreenshot') {
    startScreenshotMode();
    sendResponse({success: true});
    return true;
  }

  // 기본적으로 true 반환하여 sendResponse가 비동기적으로 호출될 수 있도록 함
  return true;
});

// 테스트용 콘솔 명령어 (개발 시 사용)
console.log('Smart Screenshot 모듈이 로드되었습니다. 스크린샷 모드를 시작하려면 확장 프로그램 UI에서 버튼을 클릭하세요.');