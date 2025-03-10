/**
 * 스마트 스크린샷 확장 프로그램 - 백그라운드 스크립트
 * 팝업과 콘텐츠 스크립트 간의 통신 및 스크린샷 다운로드 관리
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'activateScreenshotMode') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'activateScreenshotMode' }, () => {
          try {
            sendResponse();
          } catch (e) {}
        });
      } else {
        try {
          sendResponse();
        } catch (e) {}
      }
    });
    return true;
  } else if (message.action === 'captureScreenshotSegment') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        try {
          sendResponse({ dataUrl: null });
        } catch (e) {}
      } else {
        try {
          sendResponse({ dataUrl: dataUrl });
        } catch (e) {}
      }
    });
    return true;
  } else if (message.action === 'downloadScreenshot') {
    downloadScreenshot(message.dataUrl, message.filename);
    try {
      sendResponse();
    } catch (e) {}
  }
  return false;
});

/**
 * 처리된 스크린샷 다운로드
 */
function downloadScreenshot(dataUrl, filename) {
  chrome.downloads.download({
    url: dataUrl,
    filename: filename || 'smart_screenshot.png',
    saveAs: true
  });
}