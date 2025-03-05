// 스크린샷 모드 관련 변수
let isScreenshotMode = false;
let selectedElement = null;
let highlightedElement = null;
let highlightOverlay = null;
let isCapturing = false; // 캡처 중 플래그 추가

// 메시지 수신 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'enterScreenshotMode') {
    enterScreenshotMode();
    sendResponse({ success: true });
  } else if (message.action === 'exitScreenshotMode') {
    exitScreenshotMode();
    sendResponse({ success: true });
  } else if (message.action === 'processScreenshot') {
    processScreenshot(message, sendResponse);
    return true;
  } else if (message.action === 'processFullPageScreenshot') {
    processFullPageScreenshot(message, sendResponse);
    return true;
  } else if (message.action === 'captureFullPage') {
    captureFullPage(message.pageInfo, sendResponse);
    return true;
  }
  return true;
});

// 스크린샷 모드 진입
function enterScreenshotMode() {
  if (isScreenshotMode) return;

  isScreenshotMode = true;

  // 오버레이 생성
  createHighlightOverlay();

  // 마우스 오버 이벤트 추가
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleElementClick);

  // ESC 키 이벤트 추가
  document.addEventListener('keydown', handleKeyDown);

  // 알림 메시지 표시
  showNotification('스크린샷 모드 활성화: 원하는 영역 위에 마우스를 올리고 클릭하세요. (취소: ESC키)');

  // 커서 변경
  document.body.classList.add('screenshot-mode');
}

// 스크린샷 모드 종료
function exitScreenshotMode() {
  if (!isScreenshotMode) return;

  isScreenshotMode = false;

  // 이벤트 리스너 제거
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('click', handleElementClick);
  document.removeEventListener('keydown', handleKeyDown);

  // 하이라이트 제거
  removeHighlight();

  // 오버레이 제거
  if (highlightOverlay) {
    document.body.removeChild(highlightOverlay);
    highlightOverlay = null;
  }

  // 커서 복원
  document.body.classList.remove('screenshot-mode');
}

// 키보드 이벤트 처리
function handleKeyDown(e) {
  if (e.key === 'Escape') {
    exitScreenshotMode();
    showNotification('스크린샷 모드가 취소되었습니다.');
  }
}

// 마우스 이동 처리
function handleMouseMove(e) {
  if (isCapturing) return; // 캡처 중에는 마우스 이동 처리 무시

  const target = document.elementFromPoint(e.clientX, e.clientY);

  if (target !== highlightedElement) {
    removeHighlight();
    highlightElement(target);
    highlightedElement = target;
  }
}

// 요소 하이라이트
function highlightElement(element) {
  if (!element || element === document.body || element === document.documentElement) return;

  const rect = element.getBoundingClientRect();

  if (!highlightOverlay) return;

  // 요소의 스타일 확인
  const computedStyle = window.getComputedStyle(element);
  const borderRadius = computedStyle.borderRadius;

  // 오버레이 업데이트 - 테두리 두께(2px)를 내부로 숨기기 위해 위치 조정
  highlightOverlay.style.left = `${window.scrollX + rect.left - 2}px`;
  highlightOverlay.style.top = `${window.scrollY + rect.top - 2}px`;
  highlightOverlay.style.width = `${rect.width + 4}px`; // 테두리 보정을 위해 너비 조정 (+4px)
  highlightOverlay.style.height = `${rect.height + 4}px`; // 테두리 보정을 위해 높이 조정 (+4px)
  highlightOverlay.style.borderRadius = borderRadius;
  highlightOverlay.style.display = 'block';

  // 크기 표시 추가
  const dimensions = document.createElement('div');
  dimensions.className = 'screenshot-size-indicator';
  dimensions.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;

  // 크기 표시 위치 결정
  const offsetY = rect.height > 40 ? -25 : rect.height + 5;
  dimensions.style.left = `${window.scrollX + rect.left}px`;
  dimensions.style.top = `${window.scrollY + rect.top + offsetY}px`;

  // 기존 크기 표시 제거
  const existingDimensions = document.querySelector('.screenshot-size-indicator');
  if (existingDimensions) {
    document.body.removeChild(existingDimensions);
  }

  document.body.appendChild(dimensions);
}

// 하이라이트 제거
function removeHighlight() {
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }

  // 크기 표시 제거
  const dimensions = document.querySelector('.screenshot-size-indicator');
  if (dimensions) {
    document.body.removeChild(dimensions);
  }

  highlightedElement = null;
}

// 요소 클릭 처리
function handleElementClick(e) {
  if (!isScreenshotMode || !highlightedElement || isCapturing) return;

  e.preventDefault();
  e.stopPropagation();

  selectedElement = highlightedElement;

  // 선택된 요소 정보 수집 - 현재 요소의 정확한 위치와 크기 정보 수집
  const elementInfo = getElementInfo(selectedElement);

  // 디버깅 정보 (콘솔)
  console.log('Element Info:', elementInfo);

  // 캡처 시작 플래그 설정
  isCapturing = true;

  // 오버레이 및 측정 UI 임시 숨김
  const sizeIndicator = document.querySelector('.screenshot-size-indicator');
  if (sizeIndicator) sizeIndicator.style.display = 'none';
  if (highlightOverlay) highlightOverlay.style.display = 'none';

  // 약간의 지연을 두고 스크린샷 촬영 (UI가 숨겨질 시간 확보)
  setTimeout(() => {
    // 스크린샷 촬영 요청
    chrome.runtime.sendMessage({
      action: 'captureArea',
      elementInfo: elementInfo
    }, (response) => {
      // 캡처 종료 플래그 설정
      isCapturing = false;

      if (response && response.success) {
        showNotification('스크린샷이 저장되었습니다!');
      } else {
        showNotification('스크린샷 저장 실패: ' + (response ? response.error : '알 수 없는 오류'));

        // 실패 시 오버레이 다시 표시 (디버깅 목적)
        if (highlightOverlay && isScreenshotMode) highlightOverlay.style.display = 'block';
        if (sizeIndicator && isScreenshotMode) sizeIndicator.style.display = 'block';
      }

      exitScreenshotMode();
    });
  }, 50); // 50ms 지연
}

// 선택된 요소 정보 수집
function getElementInfo(element) {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  // 요소의 모양 결정 (직사각형, 원형, 타원 등)
  let shape = 'rectangle';
  if (computedStyle.borderRadius !== '0px') {
    if (rect.width === rect.height && computedStyle.borderRadius === '50%') {
      shape = 'circle';
    } else {
      shape = 'rounded';
    }
  }

  return {
    element: element.tagName,
    // 뷰포트 기준 좌표와 치수
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    },
    // 절대 좌표 (스크롤 위치 포함)
    pageLeft: rect.left + window.scrollX,
    pageTop: rect.top + window.scrollY,
    // 크기 정보
    width: rect.width,
    height: rect.height,
    // 스타일 정보
    borderRadius: computedStyle.borderRadius,
    shape: shape,
    // 현재 스크롤 위치
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    // 뷰포트 정보
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    // 페이지 전체 크기
    pageWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      document.documentElement.clientWidth
    ),
    pageHeight: Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.clientHeight
    )
  };
}

// 하이라이트 오버레이 생성
function createHighlightOverlay() {
  highlightOverlay = document.createElement('div');
  highlightOverlay.classList.add('screenshot-highlight-overlay');

  // 인라인 스타일 설정
  highlightOverlay.style.position = 'absolute';
  highlightOverlay.style.border = '2px dashed #3498db';
  highlightOverlay.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
  highlightOverlay.style.zIndex = '2147483647';
  highlightOverlay.style.pointerEvents = 'none';
  highlightOverlay.style.display = 'none';

  document.body.appendChild(highlightOverlay);
}

// 알림 메시지 표시
function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.classList.add('screenshot-notification');

  // 기존 알림이 있으면 제거
  const existingNotifications = document.querySelectorAll('.screenshot-notification');
  existingNotifications.forEach(node => {
    document.body.removeChild(node);
  });

  // 알림 스타일
  Object.assign(notification.style, {
    position: 'fixed',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '10px 15px',
    borderRadius: '5px',
    zIndex: '2147483647',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    textAlign: 'center',
    maxWidth: '80%'
  });

  document.body.appendChild(notification);

  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
}

// 스크린샷 이미지 처리 (단일 뷰포트)
function processScreenshot(message, sendResponse) {
  try {
    const { screenshotUrl, elementInfo } = message;
    const image = new Image();
    image.onload = () => {
      const dpr = window.devicePixelRatio || 1; // device pixel ratio 적용
      // 캔버스 크기를 device 픽셀에 맞게 설정
      const canvas = document.createElement('canvas');
      canvas.width = elementInfo.width * dpr;
      canvas.height = elementInfo.height * dpr;
      const ctx = canvas.getContext('2d');

      // 좌표와 크기를 devicePixelRatio에 맞게 보정하여 이미지 그리기
      ctx.drawImage(
        image,
        elementInfo.rect.left * dpr,
        elementInfo.rect.top * dpr,
        elementInfo.width * dpr,
        elementInfo.height * dpr,
        0, 0,
        canvas.width,
        canvas.height
      );

      const dataUrl = canvas.toDataURL('image/png');
      sendResponse({ success: true, dataUrl });
    };

    image.onerror = (error) => {
      console.error('Failed to load image:', error);
      sendResponse({ success: false, error: 'Failed to load image' });
    };

    image.src = screenshotUrl;
  } catch (error) {
    console.error('Process screenshot error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 전체 페이지 스크린샷 처리
function processFullPageScreenshot(message, sendResponse) {
  try {
    const { screenshotUrl, elementInfo } = message;

    // 이미지 생성 및 로드
    const image = new Image();

    image.onload = () => {
      // 캔버스 생성
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 캔버스 크기 설정
      canvas.width = elementInfo.width;
      canvas.height = elementInfo.height;

      // 이미지 그리기 - 클리핑 없이 단순 복사
      ctx.drawImage(
        image,
        0, 0,
        elementInfo.width,
        elementInfo.height,
        0, 0,
        elementInfo.width,
        elementInfo.height
      );

      // 이미지 데이터 추출
      const dataUrl = canvas.toDataURL('image/png');

      // 응답 반환
      sendResponse({ success: true, dataUrl });
    };

    image.onerror = (error) => {
      console.error('Failed to load full page image:', error);
      sendResponse({ success: false, error: 'Failed to load image' });
    };

    image.src = screenshotUrl;
  } catch (error) {
    console.error('Process full page screenshot error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 전체 페이지 캡처 (캡처 -> 스티칭)
function captureFullPage(pageInfo, sendResponse) {
  try {
    // 원래 스크롤 위치 저장
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    // 임시 캔버스 생성
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 전체 페이지 크기로 캔버스 설정
    canvas.width = pageInfo.width;
    canvas.height = pageInfo.height;

    // 캡처할 뷰포트 수 계산
    const horizontalCaptures = Math.ceil(pageInfo.width / pageInfo.viewportWidth);
    const verticalCaptures = Math.ceil(pageInfo.height / pageInfo.viewportHeight);

    // 모든 캡처가 완료되면 결과 합치기
    let capturedParts = 0;
    const totalParts = horizontalCaptures * verticalCaptures;

    // 진행 상태 표시
    showNotification(`전체 페이지 캡처 중 (0/${totalParts})...`);

    // UI 요소 숨기기
    if (highlightOverlay) highlightOverlay.style.display = 'none';
    const sizeIndicator = document.querySelector('.screenshot-size-indicator');
    if (sizeIndicator) sizeIndicator.style.display = 'none';

    // 캡처 플래그 설정
    isCapturing = true;

    // 각 섹션 캡처 함수
    function captureViewport(x, y, callback) {
      // 해당 위치로 스크롤
      window.scrollTo(x, y);

      // 렌더링 대기
      setTimeout(() => {
        // 백그라운드에 캡처 요청
        chrome.runtime.sendMessage({ action: 'captureViewport' }, (response) => {
          if (response && response.dataUrl) {
            // 이미지 로드
            const img = new Image();
            img.onload = () => {
              // 캔버스에 이미지 그리기
              ctx.drawImage(
                img,
                0, 0,
                pageInfo.viewportWidth, pageInfo.viewportHeight,
                x, y,
                pageInfo.viewportWidth, pageInfo.viewportHeight
              );

              // 다음 파트로
              capturedParts++;
              showNotification(`전체 페이지 캡처 중 (${capturedParts}/${totalParts})...`);

              callback();
            };
            img.onerror = () => callback(new Error('Failed to load image'));
            img.src = response.dataUrl;
          } else {
            callback(new Error('Failed to capture viewport'));
          }
        });
      }, 100); // 렌더링 대기 시간
    }

    // 캡처 시작
    let currentX = 0;
    let currentY = 0;

    function captureNext() {
      if (currentY >= pageInfo.height) {
        // 모든 캡처 완료
        // 원래 스크롤 위치로 복원
        window.scrollTo(originalScrollX, originalScrollY);

        // 캡처 플래그 해제
        isCapturing = false;

        // 결과 전송
        const dataUrl = canvas.toDataURL('image/png');
        sendResponse({ success: true, dataUrl });
        showNotification('전체 페이지 캡처 완료!');
        return;
      }

      // 현재 섹션 캡처
      captureViewport(currentX, currentY, (error) => {
        if (error) {
          window.scrollTo(originalScrollX, originalScrollY);
          isCapturing = false;
          sendResponse({ success: false, error: error.message });
          return;
        }

        // 다음 섹션으로 이동
        currentX += pageInfo.viewportWidth;
        if (currentX >= pageInfo.width) {
          currentX = 0;
          currentY += pageInfo.viewportHeight;
        }

        // 다음 캡처 진행
        captureNext();
      });
    }

    // 캡처 시작
    captureNext();
  } catch (error) {
    isCapturing = false;
    sendResponse({ success: false, error: error.message });
  }

  return true; // 비동기 응답 사용
}