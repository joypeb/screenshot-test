chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, function(dataUrl) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl: dataUrl });
      }
    });
    // 비동기 응답을 위해 반드시 true를 반환합니다.
    return true;
  }
});