/**
 * 스마트 스크린샷 확장 프로그램 - 콘텐츠 스크립트
 * 선택한 요소(및 자손)를 제외한 fixed/sticky 요소를 숨기고 스크롤 캡처 후 스티칭 담당
 */

// State variables
let isScreenshotMode = false;
let selectedElement = null;
let highlightElement = null;
let toolbar = null;
let elementShape = null;
let hiddenFixedElements = []; // 숨긴 fixed/sticky 요소들의 {el, originalDisplay} 저장
let disableAnimationsStyle = null; // 비활성화 스타일 요소

// 전역 CSS 클래스 추가 (한 번만)
(function addGlobalHideFixedStyle() {
  if (!document.getElementById('ss-fixed-hidden-style')) {
    const style = document.createElement('style');
    style.id = 'ss-fixed-hidden-style';
    style.textContent = `.ss-fixed-hidden { display: none !important; }`;
    document.head.appendChild(style);
  }
})();

async function activateScreenshotMode() {
  isScreenshotMode = true;
  document.body.classList.add('ss-capturing');

  // 하이라이트 및 툴바 생성
  highlightElement = document.createElement('div');
  highlightElement.className = 'ss-highlight';
  document.body.appendChild(highlightElement);

  getCurrentBrowserZoom();
  await createToolbar();

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('keydown', handleKeyDown);
}

function getCurrentBrowserZoom() {
  const testElement = document.createElement('div');
  testElement.style.cssText = 'width:100px;height:100px;position:absolute;left:-9999px;top:-9999px';
  document.body.appendChild(testElement);
  const rect = testElement.getBoundingClientRect();
  const zoomLevel = Math.round((rect.width / 100) * 100) / 100;
  document.body.removeChild(testElement);
  window.browserZoomLevel = zoomLevel;
  return zoomLevel;
}

// 다국어 메시지
const translations = {
  en: {
    escToExit: 'Press ESC key to exit screenshot mode',
    cancel: 'Cancel'
  },
  ko: {
    escToExit: 'ESC 키를 눌러 스크린샷 모드를 종료할 수 있습니다',
    cancel: '취소'
  },
  ja: {
    escToExit: 'ESCキーでスクリーンショットモードを終了できます',
    cancel: 'キャンセル'
  },
  zh: {
    escToExit: '按ESC键退出截图模式',
    cancel: '取消'
  }
};

// 현재 언어 가져오기 (기본값: 영어)
let currentLang = 'en';

function getCurrentLanguage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['language'], (result) => {
      currentLang = result.language || 'en';
      resolve(currentLang);
    });
  });
}

// 텍스트 번역 유틸리티 함수
function getTranslatedText(key) {
  return (translations[currentLang] && translations[currentLang][key]) ||
         translations.en[key]; // 번역이 없으면 영어로 폴백
}

async function createToolbar() {
  // 언어 설정 가져오기
  await getCurrentLanguage();

  toolbar = document.createElement('div');
  toolbar.className = 'ss-toolbar';
  toolbar.style.display = 'none';

  const infoText = document.createElement('span');
  infoText.textContent = getTranslatedText('escToExit');
  infoText.style.cssText = 'color:white;padding:8px';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = getTranslatedText('cancel');
  cancelBtn.className = 'ss-cancel';
  cancelBtn.addEventListener('click', cancelScreenshotMode);

  toolbar.appendChild(infoText);
  toolbar.appendChild(cancelBtn);
  document.body.appendChild(toolbar);
  toolbar.style.display = 'flex';
}

function detectElementShape(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  let shape = { type: 'rectangle', rect: rect };
  const borderRadius = style.borderRadius;
  if (borderRadius && borderRadius !== '0px') {
    const values = borderRadius.split(' ').map(v => parseFloat(v));
    if (values.length === 1 &&
        Math.abs(rect.width - rect.height) < 2 &&
        values[0] >= rect.width / 2) {
      shape.type = 'circle';
      shape.radius = rect.width / 2;
      shape.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    } else if (values.length > 0 && values[0] > 0) {
      const minDimension = Math.min(rect.width, rect.height);
      const maxRadius = Math.max(...values);
      if (maxRadius >= minDimension / 2) {
        shape.type = 'ellipse';
        shape.radiusX = rect.width / 2;
        shape.radiusY = rect.height / 2;
        shape.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      } else {
        shape.type = 'rounded-rectangle';
        shape.borderRadius = values[0];
      }
    }
  }
  const clipPath = style.clipPath;
  if (clipPath && clipPath !== 'none') {
    shape.type = 'complex';
    shape.clipPath = clipPath;
  }
  return shape;
}

function updateHighlight(element, shape) {
  if (!element || !highlightElement) return;
  const rect = element.getBoundingClientRect();
  highlightElement.style = '';
  highlightElement.className = 'ss-highlight';
  highlightElement.style.top = `${rect.top + window.scrollY}px`;
  highlightElement.style.left = `${rect.left + window.scrollX}px`;
  highlightElement.style.width = `${rect.width}px`;
  highlightElement.style.height = `${rect.height}px`;
  switch (shape.type) {
    case 'rectangle':
      highlightElement.classList.add('ss-highlight-rectangle');
      break;
    case 'circle':
      highlightElement.classList.add('ss-highlight-circle');
      break;
    case 'ellipse':
      highlightElement.classList.add('ss-highlight-ellipse');
      highlightElement.style.borderRadius = `${shape.radiusX}px / ${shape.radiusY}px`;
      break;
    case 'rounded-rectangle':
      highlightElement.classList.add('ss-highlight-rectangle');
      highlightElement.style.borderRadius = `${shape.borderRadius}px`;
      break;
    case 'complex':
      highlightElement.classList.add('ss-highlight-complex');
      if (shape.clipPath) {
        highlightElement.style.clipPath = shape.clipPath;
      }
      break;
  }
}

function handleMouseMove(event) {
  if (!isScreenshotMode) return;
  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  const targetElement = elements.find(el =>
    !el.classList.contains('ss-highlight') &&
    !el.classList.contains('ss-toolbar'));
  if (targetElement) {
    const shape = detectElementShape(targetElement);
    updateHighlight(targetElement, shape);
    elementShape = shape;
  }
}

function handleMouseDown(event) {
  if (!isScreenshotMode) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation(); // 동일한 요소에 연결된 다른 리스너도 중지
  return false;
}

function handleMouseUp(event) {
  if (!isScreenshotMode) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  return false;
}

function handleClick(event) {
  if (!isScreenshotMode) return;

  // 이벤트 전파 완전히 중단
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  const targetElement = elements.find(el =>
    !el.classList.contains('ss-highlight') &&
    !el.classList.contains('ss-toolbar'));

  if (targetElement) {
    selectedElement = targetElement;
    // 선택된 요소에 예외 처리를 위해 클래스 추가
    selectedElement.classList.add('ss-selected-element');
    storeElementDetails(targetElement);
    highlightElement.classList.add('ss-selected');
    captureSelectedElement();
  }

  return false; // 이벤트 처리 완전히 중단
}

function storeElementDetails(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const devicePixelRatio = window.devicePixelRatio || 1;
  const zoomLevel = window.browserZoomLevel || 1;
  window.selectedElementDetails = {
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right
    },
    scrollPosition: { x: 0, y: 0 },
    computedStyle: {
      transform: style.transform,
      borderRadius: style.borderRadius,
      clipPath: style.clipPath
    },
    environment: {
      devicePixelRatio: devicePixelRatio,
      zoomLevel: zoomLevel,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      timestamp: Date.now()
    }
  };
}

function handleKeyDown(event) {
  if (event.key === 'Escape') cancelScreenshotMode();
}

/**
 * 선택한 요소 이외(자식 포함)에서 position이 fixed 또는 sticky인 요소들을 숨김
 * 숨기기 전 각 요소에 .ss-fixed-hidden 클래스를 추가하고, hiddenFixedElements 배열에 저장
 */
function hideFixedElements() {
  hiddenFixedElements = []; // 초기화
  const allElements = Array.from(document.querySelectorAll("*"));
  allElements.forEach(el => {
    const pos = window.getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'sticky') {
      // 선택한 요소 및 그 자손, 그리고 선택된 요소에 부여된 'ss-selected-element'는 제외
      if (selectedElement && (el === selectedElement || selectedElement.contains(el) || el.classList.contains('ss-selected-element'))) {
        return;
      }
      el.classList.add('ss-fixed-hidden');
      hiddenFixedElements.push(el);
    }
  });
}

/**
 * 이미 숨긴 fixed/sticky 요소들에 대해 .ss-fixed-hidden 클래스를 재적용
 */
function reapplyHiddenFixedElements() {
  hiddenFixedElements.forEach(el => {
    el.classList.add('ss-fixed-hidden');
  });
}

/**
 * 숨긴 fixed/sticky 요소들의 .ss-fixed-hidden 클래스를 제거하여 원래 상태로 복원
 */
function restoreFixedElements() {
  hiddenFixedElements.forEach(el => {
    el.classList.remove('ss-fixed-hidden');
  });
  hiddenFixedElements = [];
}

/**
 * CSS 애니메이션 및 전환 비활성화 – style 엘리먼트 삽입
 */
function disableAnimations() {
  const style = document.createElement('style');
  style.id = 'disable-animations';
  style.textContent = `
    * {
      transition-duration: 0s !important;
      animation-duration: 0s !important;
    }
    html {
      scroll-behavior: auto !important;
    }
  `;
  document.head.appendChild(style);
  return style;
}

function removeDisableAnimations(styleElement) {
  if (styleElement && styleElement.parentNode) {
    styleElement.parentNode.removeChild(styleElement);
  }
}

/**
 * 선택한 요소 캡처 – 스크롤하여 전체 영역(화면 밖 포함) 캡처 후 스티칭
 * 스크롤 중에도 reapplyHiddenFixedElements()를 호출하여 fixed/sticky 요소가 나타나지 않도록 함
 */
async function captureSelectedElement() {
  if (!selectedElement) {
    console.error('캡처할 요소가 선택되지 않았습니다');
    return;
  }
  // 오버레이 제거
  if (highlightElement && highlightElement.parentNode) {
    highlightElement.parentNode.removeChild(highlightElement);
    highlightElement = null;
  }
  if (toolbar && toolbar.parentNode) {
    toolbar.parentNode.removeChild(toolbar);
    toolbar = null;
  }
  // 선택한 요소가 fixed/sticky가 아니라면 숨김 처리
  const selPos = window.getComputedStyle(selectedElement).position;
  if (!(selPos === 'fixed' || selPos === 'sticky')) {
    hideFixedElements();
  }
  const animationsStyle = disableAnimations();
  try {
    await captureElementByScrolling();
  } finally {
    restoreFixedElements();
    removeDisableAnimations(animationsStyle);
  }
}

async function captureElementByScrolling() {
  const rect = selectedElement.getBoundingClientRect();
  // 최종 캔버스 크기를 정수로 결정
  const elementWidth = Math.round(rect.width);
  const elementHeight = Math.round(rect.height);
  const devicePixelRatio = window.devicePixelRatio || 1;
  const elementAbsoluteTop = rect.top + window.scrollY;
  const elementAbsoluteLeft = rect.left + window.scrollX;
  const viewportHeight = window.innerHeight;
  const originalScrollY = window.scrollY;

  const firstSegment = Math.floor(elementAbsoluteTop / viewportHeight);
  const lastSegment = Math.floor((elementAbsoluteTop + elementHeight - 1) / viewportHeight);
  const segments = [];

  for (let i = firstSegment; i <= lastSegment; i++) {
    window.scrollTo(0, i * viewportHeight);
    await new Promise(resolve => setTimeout(resolve, 1000));
    // 매 구간 캡처 전 재적용 (선택한 요소가 fixed/sticky가 아닌 경우)
    if (!(window.getComputedStyle(selectedElement).position === 'fixed' ||
          window.getComputedStyle(selectedElement).position === 'sticky')) {
      reapplyHiddenFixedElements();
    }
    const dataUrl = await captureSegment();
    segments.push({ dataUrl, segmentIndex: i });
  }
  window.scrollTo(0, originalScrollY);

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = elementWidth;
  finalCanvas.height = elementHeight;
  const finalCtx = finalCanvas.getContext('2d');

  for (const seg of segments) {
    const img = await loadImage(seg.dataUrl);
    const segmentTop = seg.segmentIndex * viewportHeight;
    // 정수로 crop 좌표 계산
    const cropY = seg.segmentIndex === firstSegment ? Math.floor(elementAbsoluteTop - segmentTop) : 0;
    const cropBottom = seg.segmentIndex === lastSegment ? Math.ceil(elementAbsoluteTop + elementHeight - segmentTop) : viewportHeight;
    const cropHeight = cropBottom - cropY;
    const cropX = Math.floor(elementAbsoluteLeft - window.scrollX);
    const cropWidth = elementWidth; // 이미 정수화됨
    const sX = Math.round(cropX * devicePixelRatio);
    const sY = Math.round(cropY * devicePixelRatio);
    const sWidth = Math.round(cropWidth * devicePixelRatio);
    const sHeight = Math.round(cropHeight * devicePixelRatio);
    const destY = seg.segmentIndex === firstSegment ? 0 : (seg.segmentIndex * viewportHeight - Math.floor(elementAbsoluteTop));
    finalCtx.drawImage(img, sX, sY, sWidth, sHeight, 0, destY, cropWidth, cropHeight);
  }

  const finalDataUrl = finalCanvas.toDataURL('image/png');
  chrome.runtime.sendMessage({
    action: 'downloadScreenshot',
    dataUrl: finalDataUrl,
    filename: generateFilename()
  });
  exitScreenshotMode();
}

function captureSegment() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'captureScreenshotSegment' }, response => {
      if (response && response.dataUrl) resolve(response.dataUrl);
      else resolve(null);
    });
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function generateFilename() {
  const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
  const pageName = document.title.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 20);
  return `${pageName}_${timestamp}.png`;
}

function cancelScreenshotMode() {
  exitScreenshotMode();
}

function exitScreenshotMode() {
  isScreenshotMode = false;
  selectedElement = null;
  elementShape = null;

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('click', handleClick, true); // true 파라미터 추가
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('mouseup', handleMouseUp, true);
  document.removeEventListener('keydown', handleKeyDown);

  if (highlightElement && highlightElement.parentNode) {
    highlightElement.parentNode.removeChild(highlightElement);
    highlightElement = null;
  }
  if (toolbar && toolbar.parentNode) {
    toolbar.parentNode.removeChild(toolbar);
    toolbar = null;
  }
  document.body.classList.remove('ss-capturing');
  chrome.storage.local.set({ screenshotActive: false });
}

function saveScreenshot() {
  captureSelectedElement();
}

// 메시지 수신 처리
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
    case 'activateScreenshotMode':
      await activateScreenshotMode();
      break;
    case 'cancelScreenshot':
      cancelScreenshotMode();
      break;
    case 'saveScreenshot':
      saveScreenshot();
      break;
    case 'languageChanged':
      // 언어가 변경되면 현재 언어 업데이트
      if (message.language) {
        currentLang = message.language;
        // 툴바가 보이는 상태라면 텍스트 업데이트
        if (toolbar && toolbar.style.display !== 'none') {
          const infoText = toolbar.querySelector('span');
          const cancelBtn = toolbar.querySelector('button');
          if (infoText) infoText.textContent = getTranslatedText('escToExit');
          if (cancelBtn) cancelBtn.textContent = getTranslatedText('cancel');
        }
      }
      break;
  }
  // sendResponse를 지원하기 위해 true 반환
  return true;
});