/**
 * Smart Screenshot Extension - Popup Script
 * 팝업 UI 인터랙션 처리
 */

const startButton = document.getElementById('startScreenshot');
const captureOptions = document.getElementById('captureOptions');
const saveButton = document.getElementById('saveScreenshot');
const cancelButton = document.getElementById('cancelScreenshot');

/**
 * 팝업 초기화
 */
function initPopup() {
  startButton.addEventListener('click', startScreenshotMode);
  saveButton.addEventListener('click', saveScreenshot);
  cancelButton.addEventListener('click', cancelScreenshot);

  chrome.storage.local.get(['screenshotActive'], (result) => {
    if (result.screenshotActive) {
      startButton.classList.add('hidden');
      captureOptions.classList.remove('hidden');
    }
  });
}

/**
 * 현재 탭에서 스크린샷 모드 시작
 */
function startScreenshotMode() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    chrome.storage.local.set({ screenshotActive: true }, () => {
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: injectScreenshotMode
      });
      startButton.classList.add('hidden');
      captureOptions.classList.remove('hidden');
      window.close();
    });
  });
}

/**
 * 웹 페이지 컨텍스트에서 실행될 함수
 */
function injectScreenshotMode() {
  chrome.runtime.sendMessage({ action: 'activateScreenshotMode' });
}

/**
 * 캡처된 스크린샷 저장
 */
function saveScreenshot() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'saveScreenshot' });
    chrome.storage.local.set({ screenshotActive: false });
    window.close();
  });
}

/**
 * 스크린샷 모드 취소
 */
function cancelScreenshot() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelScreenshot' });
    chrome.storage.local.set({ screenshotActive: false });
    startButton.classList.remove('hidden');
    captureOptions.classList.add('hidden');
  });
}

document.addEventListener('DOMContentLoaded', initPopup);