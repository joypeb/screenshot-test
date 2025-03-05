/**
 * 초기화 함수: UI 초기 설정 및 이벤트 리스너 등록
 */
function initializeUI() {
  addEventListeners();
  // 향후 추가 초기화 로직이 있다면 이곳에 작성 (예: 사용자 설정 로드 등)
}

/**
 * 이벤트 리스너 등록 함수
 */
function addEventListeners() {
  const screenshotBtn = document.getElementById('screenshotBtn');
  screenshotBtn.addEventListener('click', handleScreenshotClick);
}

/**
 * 스크린샷 버튼 클릭 시 처리 함수
 * - 선택된 이미지 포맷과 저장 옵션을 확인한 후 스크린샷 모드 시작
 */
function handleScreenshotClick() {
  const format = getFormat();
  const saveOption = getSaveOption();

  // 설정 값을 저장
  saveSettings(format, saveOption);

  // 현재 활성화된 탭에 스크린샷 모드 시작 메시지 전송
  startScreenshotMode();
}

/**
 * 스크린샷 모드 시작 함수
 * - 현재 활성화된 탭에 content script를 삽입 후 스크린샷 모드 활성화
 */
function startScreenshotMode() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const activeTab = tabs[0];

    // 먼저 content script가 이미 로드되었는지 확인
    chrome.tabs.sendMessage(
      activeTab.id,
      {action: "checkScriptLoaded"},
      function(response) {
        // 오류가 발생하면(수신자가 없으면) content script를 삽입
        if (chrome.runtime.lastError) {
          console.log("Content script가 로드되지 않았습니다. 스크립트를 삽입합니다.");

          // executeScript를 사용하여 content script 동적 삽입
          chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            files: ['screenshotMode.js']
          }, function() {
            // 스크립트 삽입 후 약간의 지연 시간을 두고 메시지 전송
            setTimeout(() => {
              sendStartMessage(activeTab.id);
            }, 100);
          });
        } else {
          // Content script가 이미 로드되어 있으면 바로 메시지 전송
          sendStartMessage(activeTab.id);
        }
      }
    );
  });
}

/**
 * 스크린샷 시작 메시지 전송 함수
 * @param {number} tabId - 메시지를 보낼 탭 ID
 */
function sendStartMessage(tabId) {
  chrome.tabs.sendMessage(
    tabId,
    {action: "startScreenshot"},
    function(response) {
      // 오류 처리
      if (chrome.runtime.lastError) {
        console.error("메시지 전송 오류:", chrome.runtime.lastError.message);
        return;
      }

      // 스크린샷 모드가 시작되면 팝업 창 닫기
      if (response && response.success) {
        window.close();
      }
    }
  );
}

/**
 * 설정 저장 함수
 * - 사용자가 선택한 포맷과 저장 옵션을 브라우저 스토리지에 저장
 * @param {string} format - 이미지 포맷 (png, jpg)
 * @param {string} saveOption - 저장 방식 (파일, 클립보드, 클라우드)
 */
function saveSettings(format, saveOption) {
  chrome.storage.local.set({
    'screenshot_format': format,
    'screenshot_saveOption': saveOption
  }, function() {
    console.log('설정이 저장되었습니다.');
  });
}

/**
 * 선택된 이미지 포맷 값을 반환
 * @returns {string} 'png' 또는 'jpg'
 */
function getFormat() {
  const formatSelect = document.getElementById('formatSelect');
  return formatSelect.value;
}

/**
 * 선택된 저장 옵션 값을 반환
 * @returns {string} 'file', 'clipboard', 또는 'cloud'
 */
function getSaveOption() {
  const saveOptionSelect = document.getElementById('saveOptionSelect');
  return saveOptionSelect.value;
}

/**
 * 저장된 설정 불러오기 함수
 * - 이전에 저장한 설정이 있으면 UI에 적용
 */
function loadSettings() {
  chrome.storage.local.get(['screenshot_format', 'screenshot_saveOption'], function(result) {
    if (result.screenshot_format) {
      document.getElementById('formatSelect').value = result.screenshot_format;
    }

    if (result.screenshot_saveOption) {
      document.getElementById('saveOptionSelect').value = result.screenshot_saveOption;
    }
  });
}

// 캡처 완료 메시지 리스너 (향후 구현)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'captureComplete') {
    // 캡처 성공 시 알림 또는 추가 처리
    console.log('캡처가 완료되었습니다:', request.result);
  }
});

// 확장 프로그램 팝업 로드 시 초기화 함수 및 설정 로드 실행
document.addEventListener('DOMContentLoaded', function() {
  initializeUI();
  loadSettings();
});