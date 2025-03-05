// 메시지 리스너 등록
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'initScreenshot') {
    initScreenshot(sendResponse);
    return true;
  } else if (message.action === 'captureArea') {
    captureArea(message.elementInfo, sender.tab.id, sendResponse);
    return true;
  } else if (message.action === 'captureFullPage') {
    captureFullPage(sender.tab.id, sendResponse);
    return true;
  } else if (message.action === 'captureViewport') {
    // 현재 뷰포트 캡처하여 반환 (전체 페이지 캡처에서 사용)
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ success: true, dataUrl });
    });
    return true;
  }
});

// 스크린샷 모드 초기화
function initScreenshot(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'enterScreenshotMode' }, (response) => {
      if (callback) callback(response);
    });
  });
}

// 영역 캡처 처리 - 간소화된 버전, 단순히 현재 화면을 캡처하고 콘텐츠 스크립트에서 처리
async function captureArea(elementInfo, tabId, callback) {
  try {
    console.log('Capturing area:', elementInfo);

    // UI를 숨기는 시간 확보
    await new Promise(resolve => setTimeout(resolve, 100));

    // 화면 캡처
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (screenshotUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Capture error:', chrome.runtime.lastError);
        callback({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      // 캡처한 이미지를 콘텐츠 스크립트로 전달해서 처리
      chrome.tabs.sendMessage(tabId, {
        action: 'processScreenshot',
        screenshotUrl: screenshotUrl,
        elementInfo: elementInfo
      }, (response) => {
        if (response && response.success) {
          saveScreenshot(response.dataUrl, callback);
        } else {
          if (callback) callback({
            success: false,
            error: response ? response.error : 'Unknown error'
          });
        }
      });
    });
  } catch (error) {
    console.error('Screenshot capture error:', error);
    if (callback) callback({ success: false, error: error.message });
  }
}

// 전체 페이지 캡처
async function captureFullPage(tabId, callback) {
  try {
    // 페이지 크기 및 스크롤 정보 가져오기
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => ({
        width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      })
    });

    const pageInfo = results[0].result;

    // 콘텐츠 스크립트에 전체 페이지 캡처 요청
    chrome.tabs.sendMessage(tabId, {
      action: 'captureFullPage',
      pageInfo: pageInfo
    }, (response) => {
      if (response && response.success) {
        saveScreenshot(response.dataUrl, callback);
      } else {
        if (callback) callback({ success: false, error: response ? response.error : 'Unknown error' });
      }
    });

  } catch (error) {
    console.error('Full page capture error:', error);
    if (callback) callback({ success: false, error: error.message });
  }
}

// 스크린샷 저장
function saveScreenshot(dataUrl, callback) {
  // 현재 날짜와 시간으로 파일명 생성
  const date = new Date();
  const filename = `screenshot_${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}.png`;

  // 다운로드 시작
  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Download error:', chrome.runtime.lastError);
      if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
    } else {
      if (callback) callback({ success: true, downloadId });
    }
  });
}