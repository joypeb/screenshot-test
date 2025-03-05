/**
 * Smart Screenshot - Background Script
 *
 * 백그라운드 스크립트는 다음 역할을 담당합니다:
 * 1. 컨텐츠 스크립트와 팝업 간의 통신 중계
 * 2. 캡처 명령 실행 및 이미지 처리
 * 3. 다운로드, 클립보드 복사, 클라우드 업로드 등 기능 처리
 */

// 캡처 명령 처리 리스너
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // 요소 캡처 요청 처리
  if (request.action === 'captureElement') {
    console.log('요소 캡처 요청 수신:', request.elementInfo);

    // 저장된 설정 불러오기
    chrome.storage.local.get(['screenshot_format', 'screenshot_saveOption'], function(settings) {
      const format = settings.screenshot_format || 'png';
      const saveOption = settings.screenshot_saveOption || 'file';

      // 캡처 명령 실행
      captureVisibleTab(request.elementInfo, format, saveOption);
    });

    return true; // 비동기 응답 사용
  }
});

/**
 * 현재 탭의 화면을 캡처하고 요소 부분만 추출
 * @param {Object} elementInfo - 캡처할 요소 정보
 * @param {string} format - 저장할 이미지 포맷
 * @param {string} saveOption - 저장 방식 (파일, 클립보드, 클라우드)
 */
function captureVisibleTab(elementInfo, format, saveOption) {
  // 현재 활성 탭 캡처
  chrome.tabs.captureVisibleTab(null, {format: format}, function(dataUrl) {
    if (chrome.runtime.lastError) {
      console.error('캡처 중 오류 발생:', chrome.runtime.lastError);
      return;
    }

    // 요소 영역만 추출 (캔버스 사용, 실제 구현은 추후 개발)
    cropImage(dataUrl, elementInfo.rect, format).then(croppedImageUrl => {
      // 저장 옵션에 따라 처리
      switch (saveOption) {
        case 'file':
          downloadImage(croppedImageUrl, format);
          break;
        case 'clipboard':
          copyToClipboard(croppedImageUrl);
          break;
        case 'cloud':
          uploadToCloud(croppedImageUrl, format);
          break;
        default:
          downloadImage(croppedImageUrl, format);
      }
    });
  });
}

/**
 * 캡처된 이미지에서 요소 영역만 추출
 * @param {string} imageDataUrl - 전체 화면 캡처 이미지 (Data URL)
 * @param {Object} rect - 추출할 영역 정보 (top, left, width, height)
 * @param {string} format - 저장할 이미지 포맷
 * @returns {Promise<string>} 잘라낸 이미지의 Data URL
 */
function cropImage(imageDataUrl, rect, format) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function() {
      // 캔버스 생성 및 크기 설정
      const canvas = document.createElement('canvas');
      canvas.width = rect.width;
      canvas.height = rect.height;

      // 요소 영역만 추출하여 그리기
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        rect.left, rect.top, rect.width, rect.height,
        0, 0, rect.width, rect.height
      );

      // 포맷에 따른 이미지 품질 설정
      let quality = 0.92;
      let mimeType = 'image/png';

      if (format === 'jpg') {
        mimeType = 'image/jpeg';
        quality = 0.85;
      }

      // 결과 이미지를 Data URL로 변환
      const croppedImageUrl = canvas.toDataURL(mimeType, quality);
      resolve(croppedImageUrl);
    };

    img.src = imageDataUrl;
  });
}

/**
 * 이미지를 파일로 다운로드
 * @param {string} imageDataUrl - 다운로드할 이미지 (Data URL)
 * @param {string} format - 이미지 포맷 (확장자 결정)
 */
function downloadImage(imageDataUrl, format) {
  // 파일명 생성 (현재 날짜/시간 기반)
  const date = new Date();
  const timestamp = date.toISOString().replace(/[-:.TZ]/g, '');
  const filename = `screenshot_${timestamp}.${format}`;

  // 다운로드 실행
  chrome.downloads.download({
    url: imageDataUrl,
    filename: filename,
    saveAs: true
  }, function(downloadId) {
    if (chrome.runtime.lastError) {
      console.error('다운로드 중 오류 발생:', chrome.runtime.lastError);
      return;
    }

    // 다운로드 완료 메시지 전송
    chrome.runtime.sendMessage({
      action: 'captureComplete',
      result: {
        success: true,
        method: 'download',
        filename: filename
      }
    });
  });
}

/**
 * 이미지를 클립보드에 복사 (기본 구현)
 * @param {string} imageDataUrl - 복사할 이미지 (Data URL)
 */
function copyToClipboard(imageDataUrl) {
  // 클립보드 API를 사용한 구현 (향후 개발)
  // 현재는 파일로 저장하는 대체 동작 수행

  console.log('클립보드 복사 요청됨');
  console.log('현재 클립보드 복사 기능은 개발 중입니다.');

  // 임시로 파일 다운로드로 대체
  downloadImage(imageDataUrl, 'png');
}

/**
 * 이미지를 클라우드에 업로드 (기본 구현)
 * @param {string} imageDataUrl - 업로드할 이미지 (Data URL)
 * @param {string} format - 이미지 포맷
 */
function uploadToCloud(imageDataUrl, format) {
  // 클라우드 업로드 API 연동 (향후 개발)
  // 현재는 파일로 저장하는 대체 동작 수행

  console.log('클라우드 업로드 요청됨');
  console.log('현재 클라우드 업로드 기능은 개발 중입니다.');

  // 임시로 파일 다운로드로 대체
  downloadImage(imageDataUrl, format);
}

/**
 * 확장 프로그램이 설치되거나 브라우저가 시작될 때 실행
 */
chrome.runtime.onInstalled.addListener(function() {
  console.log('Smart Screenshot 확장 프로그램이 설치/업데이트되었습니다.');
});

/**
 * 탭이 업데이트될 때 content script가 로드되었는지 확인
 */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // 페이지 로드가 완료되었을 때만 실행
  if (changeInfo.status === 'complete' && /^http/.test(tab.url)) {
    // content script가 로드되었는지 확인하는 메시지 전송
    chrome.tabs.sendMessage(tabId, {action: "checkScriptLoaded"}, function(response) {
      // 오류가 발생하면(수신자가 없으면) content script를 삽입
      if (chrome.runtime.lastError) {
        console.log(`탭 ${tabId}에 content script가 로드되지 않았습니다.`);
        // 필요한 경우 여기서 스크립트를 자동 삽입할 수 있음
      }
    });
  }
});

// 백그라운드 스크립트 로드 완료
console.log('Smart Screenshot 백그라운드 스크립트가 로드되었습니다.');